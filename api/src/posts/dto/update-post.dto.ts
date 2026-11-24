import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePostDto } from 'src/posts/dto/create-post.dto';

/**
 * Every field optional; only the fields sent change. The section cannot change.
 * `imageKeys` / `topicIds` replace the whole list. `caseDetails` / `opportunity`: an object
 * replaces them, `null` removes them.
 */
export class UpdatePostDto extends PartialType(
  OmitType(CreatePostDto, ['sectionId'] as const),
) {}
