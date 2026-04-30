export {
  VALID_BADGES,
  DEFAULT_LAYER_NAMES,
  DEFAULT_FILE_NAMING,
  DEFAULT_SIZE_PRESET,
} from './types.js';

export type {
  ValidBadgeName,
  BadgeInfo,
  CardNewsRow,
  BoundingBox,
  OverflowResult,
  ExportResult,
  HistoryFile,
  HistoryError,
  HistoryRecord,
  RowResult,
  GenerationProgress,
  TemplateLayerNames,
  LayerSpec,
  TemplateSpec,
  FileNamingPattern,
  ImageSizePreset,
  AppConfig,
} from './types.js';

// API 응답 타입
export {
  ErrorCode,
  ErrorMessages,
} from './api-types.js';

export type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
} from './api-types.js';
