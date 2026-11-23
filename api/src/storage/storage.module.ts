import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesController } from 'src/storage/files.controller';
import { UploadsController } from 'src/storage/uploads.controller';
import { LocalStorageDriver } from 'src/storage/local-storage.driver';
import { S3StorageDriver } from 'src/storage/s3-storage.driver';
import { StorageDriver } from 'src/storage/storage-driver';
import { StorageService } from 'src/storage/storage.service';

/** Global: any feature module can inject StorageService. */
@Global()
@Module({
  controllers: [FilesController, UploadsController],
  providers: [
    StorageService,
    // STORAGE_DRIVER=s3 when hosted (the host's disk is wiped on every deploy); local folder
    // otherwise (development, tests). See docs/DEPLOY.md.
    {
      provide: StorageDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageDriver =>
        config.get<string>('STORAGE_DRIVER') === 's3'
          ? new S3StorageDriver(config)
          : new LocalStorageDriver(config),
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
