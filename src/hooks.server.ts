import type { Handle } from '@sveltejs/kit/hooks';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';

// 创建一个 handle 来使用 paraglide 中间件
const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(
		event.request,
		({ request: localizedRequest, locale }) => {
			return resolve(
				{ ...event, request: localizedRequest },
				{
					transformPageChunk: ({ html }) => {
						return html
							.replace('%lang%', locale)
							.replace('%dir%', getTextDirection(locale));
					}
				}
			);
		}
	);

export const handle: Handle = paraglideHandle;
