import { Global, Module } from '@nestjs/common';
import { FilesController } from 'src/storage/files.controller';
import { UploadsController } from 'src/storage/uploads.controller';
import { LocalStorageDriver } from 'src/storage/local-storage.driver';
import { StorageDriver } from 'src/storage/storage-driver';
import { StorageService } from 'src/storage/storage.service';

/** Global: any feature module can inject StorageService. */
@Global()
@Module({
  controllers: [FilesController, UploadsController],
  providers: [
    StorageService,
    // Only the local driver exists for now (see docs/OUTSIDE-BOOTCAMP.md).
    { provide: StorageDriver, useClass: LocalStorageDriver },
  ],
  exports: [StorageService],
})
export class StorageModule {}
