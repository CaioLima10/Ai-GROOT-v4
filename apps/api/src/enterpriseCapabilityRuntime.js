import { buildCapabilityMatrix, getResearchCapabilities } from "../../../packages/shared-config/src/index.js"
import { listDocumentFormats } from "../../../packages/ai-core/src/index.js"
import {
  SUPPORTED_UPLOAD_ACCEPT,
  isImageGenerationEnabled,
  uploadOcrEnabled
} from "./enterpriseAssetsRuntime.js"
import { getLiveResearchRuntime } from "./liveResearch.js"

export function buildRuntimeCapabilityMatrix() {
  const runtimeResearchCapabilities = getResearchCapabilities()
  const liveResearchRuntime = getLiveResearchRuntime()
  const liveWebEnabled = Boolean(
    runtimeResearchCapabilities.liveWeb ||
    runtimeResearchCapabilities.google ||
    runtimeResearchCapabilities.bing ||
    runtimeResearchCapabilities.yahoo ||
    runtimeResearchCapabilities.scholar ||
    runtimeResearchCapabilities.news ||
    runtimeResearchCapabilities.codeSearch ||
    runtimeResearchCapabilities.browserAutomation ||
    liveResearchRuntime.googleSearch
  )

  const documentGenerationFormats = listDocumentFormats()
  const documentGenerationFormatIds = documentGenerationFormats.map((entry) => entry.format)

  return buildCapabilityMatrix({
    uploadAccept: SUPPORTED_UPLOAD_ACCEPT,
    ocrEnabled: uploadOcrEnabled,
    docxEnabled: true,
    xlsxEnabled: true,
    pptxEnabled: true,
    imageGenerationEnabled: isImageGenerationEnabled(),
    imageGenerationProvider: isImageGenerationEnabled() ? "huggingface" : "disabled",
    imageControlsEnabled: true,
    visualImageUnderstanding: uploadOcrEnabled,
    imageEditingEnabled: false,
    liveWebEnabled,
    weatherForecastEnabled: Boolean(runtimeResearchCapabilities.weatherForecast),
    googleSearchEnabled: Boolean(liveResearchRuntime.googleSearch),
    googleImageSearchEnabled: Boolean(liveResearchRuntime.googleImageSearch),
    sportsScheduleEnabled: Boolean(liveResearchRuntime.sportsSchedule),
    browserPdfExport: true,
    serverPdfGeneration: true,
    structuredDocsNative: true,
    documentGenerationFormats: documentGenerationFormatIds,
    privacyRedaction: true,
    sensitiveLearningBlocked: true,
    temporaryUploads: true
  })
}
