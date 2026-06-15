/**
 * UJverse — barrel exports dla scraperów komunikatów wydziałowych.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
export type { ParsedAnnouncement, ParserKind, FacultySource, AnnouncementStatus } from './types.js'
export { FACULTY_SOURCES, DEPARTMENT_TO_SOURCE_IDS } from './sources.js'
export { parseIsiDrupal } from './isiDrupalParser.js'
export { parseLiferay, parseFullLiferayArticle } from './liferayParser.js'
export { parseWordpressCm, parseFullWordpressCmArticle } from './wordpressCmParser.js'
export {
  bodyFingerprintHex,
  FALLBACK_LECTURER_NAME,
  fetchHtml,
} from './utils.js'
