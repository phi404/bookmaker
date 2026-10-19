import { parseDocument } from '../../dist/domain/document.js';
import { defaultStyle } from '../../dist/domain/style.js';
import { paginate } from '../../dist/typesetting/paginator.js';
import { renderPageSVG } from '../../dist/render/svg.js';
import { restoreProject, serializeProject } from '../../dist/domain/project.js';

// Direct production functions: no alternate algorithm or adjusted fixture expectations.
export const adapter = { parse: parseDocument, defaultStyle, paginate, renderSvg: renderPageSVG, restore: restoreProject, serialize: serializeProject };
