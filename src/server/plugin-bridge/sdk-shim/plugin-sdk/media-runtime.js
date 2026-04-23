// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/media-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/media-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function resolveChannelMediaMaxBytes() { _w('resolveChannelMediaMaxBytes'); return undefined; }
function createDirectTextMediaOutbound() { _w('createDirectTextMediaOutbound'); return undefined; }
function createScopedChannelMediaMaxBytesResolver() { _w('createScopedChannelMediaMaxBytesResolver'); return undefined; }
function resolveScopedChannelMediaMaxBytes() { _w('resolveScopedChannelMediaMaxBytes'); return undefined; }
function isTelegramVoiceCompatibleAudio() { _w('isTelegramVoiceCompatibleAudio'); return false; }
function isVoiceCompatibleAudio() { _w('isVoiceCompatibleAudio'); return false; }
const TELEGRAM_VOICE_AUDIO_EXTENSIONS = undefined;
const TELEGRAM_VOICE_MIME_TYPES = undefined;
function mediaKindFromMime() { _w('mediaKindFromMime'); return undefined; }
function maxBytesForKind() { _w('maxBytesForKind'); return undefined; }
const MAX_IMAGE_BYTES = undefined;
const MAX_AUDIO_BYTES = undefined;
const MAX_VIDEO_BYTES = undefined;
const MAX_DOCUMENT_BYTES = undefined;
async function fetchRemoteMedia() { _w('fetchRemoteMedia'); return undefined; }
class MediaFetchError { constructor() { _w('MediaFetchError'); } }
async function runFfprobe() { _w('runFfprobe'); return undefined; }
async function runFfmpeg() { _w('runFfmpeg'); return undefined; }
function parseFfprobeCsvFields() { _w('parseFfprobeCsvFields'); return undefined; }
function parseFfprobeCodecAndSampleRate() { _w('parseFfprobeCodecAndSampleRate'); return undefined; }
const MEDIA_FFMPEG_MAX_BUFFER_BYTES = undefined;
const MEDIA_FFPROBE_TIMEOUT_MS = undefined;
const MEDIA_FFMPEG_TIMEOUT_MS = undefined;
const MEDIA_FFMPEG_MAX_AUDIO_DURATION_SECS = undefined;
async function getImageMetadata() { _w('getImageMetadata'); return undefined; }
async function normalizeExifOrientation() { _w('normalizeExifOrientation'); return ""; }
async function resizeToJpeg() { _w('resizeToJpeg'); return undefined; }
async function convertHeicToJpeg() { _w('convertHeicToJpeg'); return undefined; }
async function hasAlphaChannel() { _w('hasAlphaChannel'); return false; }
async function resizeToPng() { _w('resizeToPng'); return undefined; }
async function optimizeImageToPng() { _w('optimizeImageToPng'); return undefined; }
function buildImageResizeSideGrid() { _w('buildImageResizeSideGrid'); return undefined; }
const IMAGE_REDUCE_QUALITY_STEPS = undefined;
function isValidInboundPathRootPattern() { _w('isValidInboundPathRootPattern'); return false; }
function normalizeInboundPathRoots() { _w('normalizeInboundPathRoots'); return ""; }
function mergeInboundPathRoots() { _w('mergeInboundPathRoots'); return undefined; }
function isInboundPathAllowed() { _w('isInboundPathAllowed'); return false; }
function resolveIMessageAttachmentRoots() { _w('resolveIMessageAttachmentRoots'); return undefined; }
function resolveIMessageRemoteAttachmentRoots() { _w('resolveIMessageRemoteAttachmentRoots'); return undefined; }
const DEFAULT_IMESSAGE_ATTACHMENT_ROOTS = undefined;
function resolveOutboundMediaLocalRoots() { _w('resolveOutboundMediaLocalRoots'); return undefined; }
function buildOutboundMediaLoadOptions() { _w('buildOutboundMediaLoadOptions'); return undefined; }
async function assertLocalMediaAllowed() { _w('assertLocalMediaAllowed'); return undefined; }
function getDefaultLocalRoots() { _w('getDefaultLocalRoots'); return undefined; }
class LocalMediaAccessError { constructor() { _w('LocalMediaAccessError'); } }
function getDefaultMediaLocalRoots() { _w('getDefaultMediaLocalRoots'); return undefined; }
function getAgentScopedMediaLocalRoots() { _w('getAgentScopedMediaLocalRoots'); return undefined; }
function appendLocalMediaParentRoots() { _w('appendLocalMediaParentRoots'); return undefined; }
function getAgentScopedMediaLocalRootsForSources() { _w('getAgentScopedMediaLocalRootsForSources'); return undefined; }
function normalizeMimeType() { _w('normalizeMimeType'); return ""; }
function getFileExtension() { _w('getFileExtension'); return undefined; }
function isAudioFileName() { _w('isAudioFileName'); return false; }
function detectMime() { _w('detectMime'); return undefined; }
function extensionForMime() { _w('extensionForMime'); return undefined; }
function isGifMedia() { _w('isGifMedia'); return false; }
function imageMimeFromFormat() { _w('imageMimeFromFormat'); return undefined; }
function kindFromMime() { _w('kindFromMime'); return undefined; }
async function resolveOutboundAttachmentFromUrl() { _w('resolveOutboundAttachmentFromUrl'); return undefined; }
function crc32() { _w('crc32'); return undefined; }
function pngChunk() { _w('pngChunk'); return undefined; }
function fillPixel() { _w('fillPixel'); return undefined; }
function encodePngRgba() { _w('encodePngRgba'); return ""; }
async function renderQrPngBase64() { _w('renderQrPngBase64'); return undefined; }
async function readResponseWithLimit() { _w('readResponseWithLimit'); return undefined; }
async function readResponseTextSnippet() { _w('readResponseTextSnippet'); return undefined; }
async function ensureMediaDir() { _w('ensureMediaDir'); return undefined; }
async function cleanOldMedia() { _w('cleanOldMedia'); return undefined; }
async function saveMediaSource() { _w('saveMediaSource'); return undefined; }
async function saveMediaBuffer() { _w('saveMediaBuffer'); return undefined; }
function setMediaStoreNetworkDepsForTest() { _w('setMediaStoreNetworkDepsForTest'); return undefined; }
function extractOriginalFilename() { _w('extractOriginalFilename'); return undefined; }
function getMediaDir() { _w('getMediaDir'); return undefined; }
class SaveMediaSourceError { constructor() { _w('SaveMediaSourceError'); } }
const MEDIA_MAX_BYTES = undefined;
async function unlinkIfExists() { _w('unlinkIfExists'); return undefined; }
function buildAgentMediaPayload() { _w('buildAgentMediaPayload'); return undefined; }
async function transcribeFirstAudio() { _w('transcribeFirstAudio'); return undefined; }
const DEFAULT_MAX_CHARS = undefined;
const DEFAULT_MAX_CHARS_BY_CAPABILITY = undefined;
const DEFAULT_MAX_BYTES = undefined;
const DEFAULT_TIMEOUT_SECONDS = undefined;
const DEFAULT_PROMPT = undefined;
const DEFAULT_VIDEO_MAX_BASE64_BYTES = undefined;
const DEFAULT_AUDIO_MODELS = undefined;
const AUTO_AUDIO_KEY_PROVIDERS = undefined;
const AUTO_IMAGE_KEY_PROVIDERS = undefined;
const AUTO_VIDEO_KEY_PROVIDERS = undefined;
const DEFAULT_IMAGE_MODELS = undefined;
const CLI_OUTPUT_MAX_BUFFER = undefined;
const DEFAULT_MEDIA_CONCURRENCY = undefined;
const MIN_AUDIO_FILE_BYTES = undefined;
const describeImageWithModel = undefined;
const describeImagesWithModel = undefined;
async function resolveAutoImageModel() { _w('resolveAutoImageModel'); return undefined; }
async function runCapability() { _w('runCapability'); return undefined; }
function buildProviderRegistry() { _w('buildProviderRegistry'); return undefined; }
function normalizeMediaAttachments() { _w('normalizeMediaAttachments'); return ""; }
function resolveMediaAttachmentLocalRoots() { _w('resolveMediaAttachmentLocalRoots'); return undefined; }
function createMediaAttachmentCache() { _w('createMediaAttachmentCache'); return undefined; }
function clearMediaUnderstandingBinaryCacheForTests() { _w('clearMediaUnderstandingBinaryCacheForTests'); return undefined; }
function resolvePollMaxSelections() { _w('resolvePollMaxSelections'); return undefined; }
function normalizePollInput() { _w('normalizePollInput'); return ""; }
function normalizePollDurationHours() { _w('normalizePollDurationHours'); return ""; }

module.exports = {
  resolveChannelMediaMaxBytes,
  createDirectTextMediaOutbound,
  createScopedChannelMediaMaxBytesResolver,
  resolveScopedChannelMediaMaxBytes,
  isTelegramVoiceCompatibleAudio,
  isVoiceCompatibleAudio,
  TELEGRAM_VOICE_AUDIO_EXTENSIONS,
  TELEGRAM_VOICE_MIME_TYPES,
  mediaKindFromMime,
  maxBytesForKind,
  MAX_IMAGE_BYTES,
  MAX_AUDIO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_DOCUMENT_BYTES,
  fetchRemoteMedia,
  MediaFetchError,
  runFfprobe,
  runFfmpeg,
  parseFfprobeCsvFields,
  parseFfprobeCodecAndSampleRate,
  MEDIA_FFMPEG_MAX_BUFFER_BYTES,
  MEDIA_FFPROBE_TIMEOUT_MS,
  MEDIA_FFMPEG_TIMEOUT_MS,
  MEDIA_FFMPEG_MAX_AUDIO_DURATION_SECS,
  getImageMetadata,
  normalizeExifOrientation,
  resizeToJpeg,
  convertHeicToJpeg,
  hasAlphaChannel,
  resizeToPng,
  optimizeImageToPng,
  buildImageResizeSideGrid,
  IMAGE_REDUCE_QUALITY_STEPS,
  isValidInboundPathRootPattern,
  normalizeInboundPathRoots,
  mergeInboundPathRoots,
  isInboundPathAllowed,
  resolveIMessageAttachmentRoots,
  resolveIMessageRemoteAttachmentRoots,
  DEFAULT_IMESSAGE_ATTACHMENT_ROOTS,
  resolveOutboundMediaLocalRoots,
  buildOutboundMediaLoadOptions,
  assertLocalMediaAllowed,
  getDefaultLocalRoots,
  LocalMediaAccessError,
  getDefaultMediaLocalRoots,
  getAgentScopedMediaLocalRoots,
  appendLocalMediaParentRoots,
  getAgentScopedMediaLocalRootsForSources,
  normalizeMimeType,
  getFileExtension,
  isAudioFileName,
  detectMime,
  extensionForMime,
  isGifMedia,
  imageMimeFromFormat,
  kindFromMime,
  resolveOutboundAttachmentFromUrl,
  crc32,
  pngChunk,
  fillPixel,
  encodePngRgba,
  renderQrPngBase64,
  readResponseWithLimit,
  readResponseTextSnippet,
  ensureMediaDir,
  cleanOldMedia,
  saveMediaSource,
  saveMediaBuffer,
  setMediaStoreNetworkDepsForTest,
  extractOriginalFilename,
  getMediaDir,
  SaveMediaSourceError,
  MEDIA_MAX_BYTES,
  unlinkIfExists,
  buildAgentMediaPayload,
  transcribeFirstAudio,
  DEFAULT_MAX_CHARS,
  DEFAULT_MAX_CHARS_BY_CAPABILITY,
  DEFAULT_MAX_BYTES,
  DEFAULT_TIMEOUT_SECONDS,
  DEFAULT_PROMPT,
  DEFAULT_VIDEO_MAX_BASE64_BYTES,
  DEFAULT_AUDIO_MODELS,
  AUTO_AUDIO_KEY_PROVIDERS,
  AUTO_IMAGE_KEY_PROVIDERS,
  AUTO_VIDEO_KEY_PROVIDERS,
  DEFAULT_IMAGE_MODELS,
  CLI_OUTPUT_MAX_BUFFER,
  DEFAULT_MEDIA_CONCURRENCY,
  MIN_AUDIO_FILE_BYTES,
  describeImageWithModel,
  describeImagesWithModel,
  resolveAutoImageModel,
  runCapability,
  buildProviderRegistry,
  normalizeMediaAttachments,
  resolveMediaAttachmentLocalRoots,
  createMediaAttachmentCache,
  clearMediaUnderstandingBinaryCacheForTests,
  resolvePollMaxSelections,
  normalizePollInput,
  normalizePollDurationHours,
};
