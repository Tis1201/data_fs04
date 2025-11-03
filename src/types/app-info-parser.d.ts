declare module 'app-info-parser' {
  export default class AppInfoParser {
    constructor(file: string | Buffer);
    parse(): Promise<{
      package?: string;
      versionName?: string;
      versionCode?: string | number;
      application?: {
        label?: string | string[];
        [key: string]: any;
      };
      [key: string]: any;
    }>;
  }
}

