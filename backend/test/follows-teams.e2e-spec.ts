import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

describe('Follows & team memberships (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  async function people() {
    const team = await createUserAndLogin(app, prisma, {
      email: 'team@example.com',
      name: 'Green Team',
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
    });
    const member = await createUserAndLogin(app, prisma, {
      email: 'member@example.com',
      name: 'Sara',
    });
    const regular = await createUserAndLogin(app, prisma, {
      email: 'regular@example.com',
    });
    return { team, member, regular };
  }

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  describe('follows', () => {
    it('follows and unfollows a verified account', async () => {
      const { team, member } = await people();
      const auth = bearer(member.token);

      await http()
        .post(`/api/v1/users/${team.user.id}/follow`)
        .set(auth)
        .expect(204);
      await http()
        .post(`/api/v1/users/${team.user.id}/follow`)
        .set(auth)
        .expect(409);

      const followers = await http()
        .get(`/api/v1/users/${team.user.id}/followers`)
        .expect(200);
      expect(followers.body).toMatchObject({
        data: [{ id: member.user.id, name: 'Sara' }],
        meta: { total: 1 },
      });
      expect((followers.body as { data: object[] }).data[0]).not.toHaveProperty(
        'email',
      );

      const following = await http()
        .get('/api/v1/users/me/following')
        .set(auth)
        .expect(200);
      expect(following.body).toMatchObject({ data: [{ id: team.user.id }] });

      await http()
        .delete(`/api/v1/users/${team.user.id}/follow`)
        .set(auth)
        .expect(204);
      await http()
        .delete(`/api/v1/users/${team.user.id}/follow`)
        .set(auth)
        .expect(404);
    });

    it('refuses to follow regular accounts or yourself', async () => {
      const { team, member, regular } = await people();
      await http()
        .post(`/api/v1/users/${regular.user.id}/follow`)
        .set(bearer(member.token))
        .expect(400);
      await http()
        .post(`/api/v1/users/${team.user.id}/follow`)
        .set(bearer(team.token))
        .expect(400);
      await http()
        .post('/api/v1/users/999999/follow')
        .set(bearer(member.token))
        .expect(404);
    });
  });

  describe('team memberships', () => {
    async function requestMembership(memberToken: string, teamId: number) {
      const res = await http()
        .post('/api/v1/team-memberships')
        .set(bearer(memberToken))
        .send({ teamId, role: 'متطوعة', startYear: 2022 })
        .expect(201);
      return (res.body as { id: number }).id;
    }

    it('runs request → approve → profile → remove', async () => {
      const { team, member } = await people();
      const id = await requestMembership(member.token, team.user.id);

      // Not on the profile while pending.
      const before = await http()
        .get(`/api/v1/users/${member.user.id}/teams`)
        .expect(200);
      expect(before.body).toMatchObject({ meta: { total: 0 } });

      const incoming = await http()
        .get('/api/v1/team-memberships/incoming?status=PENDING')
        .set(bearer(team.token))
        .expect(200);
      expect(incoming.body).toMatchObject({
        data: [{ id, user: { id: member.user.id } }],
      });

      await http()
        .post(`/api/v1/team-memberships/${id}/approve`)
        .set(bearer(team.token))
        .expect(200);

      const teams = await http()
        .get(`/api/v1/users/${member.user.id}/teams`)
        .expect(200);
      expect(teams.body).toMatchObject({
        data: [
          { role: 'متطوعة', team: { id: team.user.id, name: 'Green Team' } },
        ],
      });
      const members = await http()
        .get(`/api/v1/users/${team.user.id}/members`)
        .expect(200);
      expect(members.body).toMatchObject({
        data: [{ user: { id: member.user.id } }],
      });

      expect(
        await prisma.notification.findMany({
          select: { recipientId: true, type: true },
          orderBy: { id: 'asc' },
        }),
      ).toEqual([
        { recipientId: team.user.id, type: 'TEAM_MEMBERSHIP_REQUESTED' },
        { recipientId: member.user.id, type: 'TEAM_MEMBERSHIP_DECIDED' },
      ]);

      await http()
        .post(`/api/v1/team-memberships/${id}/remove`)
        .set(bearer(team.token))
        .expect(200);
      const after = await http()
        .get(`/api/v1/users/${member.user.id}/teams`)
        .expect(200);
      expect(after.body).toMatchObject({ meta: { total: 0 } });

      // Removed: the member may ask again.
      await requestMembership(member.token, team.user.id);
    });

    it('allows one pending or approved membership per team', async () => {
      const { team, member } = await people();
      await requestMembership(member.token, team.user.id);
      await http()
        .post('/api/v1/team-memberships')
        .set(bearer(member.token))
        .send({ teamId: team.user.id })
        .expect(409);
    });

    it('only lets the team decide, and only the member edit or cancel', async () => {
      const { team, member, regular } = await people();
      const id = await requestMembership(member.token, team.user.id);

      await http()
        .post(`/api/v1/team-memberships/${id}/approve`)
        .set(bearer(member.token))
        .expect(403);
      await http()
        .patch(`/api/v1/team-memberships/${id}`)
        .set(bearer(regular.token))
        .send({ role: 'x' })
        .expect(403);

      await http()
        .patch(`/api/v1/team-memberships/${id}`)
        .set(bearer(member.token))
        .send({ endYear: 2021 })
        .expect(400); // before startYear 2022
      const edited = await http()
        .patch(`/api/v1/team-memberships/${id}`)
        .set(bearer(member.token))
        .send({ endYear: 2024, description: 'حملات تشجير' })
        .expect(200);
      expect(edited.body).toMatchObject({
        startYear: 2022,
        endYear: 2024,
        role: 'متطوعة',
      });

      await http()
        .delete(`/api/v1/team-memberships/${id}`)
        .set(bearer(member.token))
        .expect(204);
      expect(await prisma.teamMembership.count()).toBe(0);
    });

    it('refuses organizations as members', async () => {
      const { team } = await people();
      const otherOrg = await createUserAndLogin(app, prisma, {
        email: 'other-org@example.com',
        name: 'Other Org',
        verifiedKind: 'ORGANIZATION',
        verifiedAt: new Date(),
      });
      await http()
        .post('/api/v1/team-memberships')
        .set(bearer(otherOrg.token))
        .send({ teamId: team.user.id })
        .expect(403);
    });

    it('requires a verified team', async () => {
      const { member, regular } = await people();
      await http()
        .post('/api/v1/team-memberships')
        .set(bearer(member.token))
        .send({ teamId: regular.user.id })
        .expect(400);
    });

    it('hides teams of users who switch them off or are under 18', async () => {
      const { team } = await people();
      const birthDate = new Date();
      birthDate.setUTCFullYear(birthDate.getUTCFullYear() - 16);
      const teen = await createUserAndLogin(app, prisma, {
        email: 'teen@example.com',
        birthDate,
      });
      const shy = await createUserAndLogin(app, prisma, {
        email: 'shy@example.com',
        showTeams: false,
      });
      for (const u of [teen, shy]) {
        const id = await requestMembership(u.token, team.user.id);
        await http()
          .post(`/api/v1/team-memberships/${id}/approve`)
          .set(bearer(team.token))
          .expect(200);
        const res = await http()
          .get(`/api/v1/users/${u.user.id}/teams`)
          .expect(200);
        expect(res.body).toMatchObject({ meta: { total: 0 } });
      }
      const members = await http()
        .get(`/api/v1/users/${team.user.id}/members`)
        .expect(200);
      expect(members.body).toMatchObject({ meta: { total: 0 } });
    });
  });
});
