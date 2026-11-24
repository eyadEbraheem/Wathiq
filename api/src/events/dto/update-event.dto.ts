import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateEventDto } from 'src/events/dto/create-event.dto';

/**
 * Every field optional; only the fields sent change. The section cannot change.
 * `imageKeys` / `topicIds` / `questions` replace the whole list. `roles` lists every role to
 * keep (with its `id`) or add (without `id`); a role left out is removed.
 */
export class UpdateEventDto extends PartialType(
  OmitType(CreateEventDto, ['sectionId'] as const),
) {}
