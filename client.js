/**
 * Client half of the image wheel-zoom/pan bundle.
 *
 * The right sidebar's document preview lets a package register additional
 * renderers for file suffixes. This package registers an `extension`-band
 * renderer for the image suffixes at the same time as the built-in image
 * renderer; the extension band wins for new image tabs, while the built-in
 * implementation remains selectable in the preview toolbar.
 *
 * The body owns a full-pane surface: the image is positioned with a CSS
 * transform, the wheel zooms around the pointer without requiring Ctrl, and a
 * left-button drag pans with a grab cursor. A compact floating toolbar mirrors
 * the familiar zoom controls (out / percentage / in / Fit / 100%).
 *
 * The renderer makes no extra file or network request: it consumes the bytes
 * the document preview has already read.
 */
window.__ModuleLoader__.load({
	id: 'dsh-image-wheel-pan',
	factory(require) {
		const React = require('react');
		const h = React.createElement;

		/** Package id, module-loader id, and stylesheet owner. */
		const PLUGIN_ID = 'dsh-image-wheel-pan';

		/** Renderer identity in the document-preview registry and its body slot key. */
		const BODY_ID = 'dsh-image-wheel-pan/image';

		/** Locale namespace and dictionaries (the zh key set is the source of truth). */
		const NS = 'dshImageWheelPan';
		const ZH = {
			renderer: '图片滚轮缩放/拖动',
			label: '图片预览',
			preview: '图片预览：{name}',
			loading: '图片加载中...',
			failed: '无法显示这张图片',
			unsupported: '图片预览需要完整文件内容',
			controls: '缩放与平移控件',
			out: '缩小',
			in: '放大',
			fit: '适应窗口',
			actual: '100%',
			hint: '滚轮缩放 · 按住左键拖动',
		};
		const EN = {
			renderer: 'Image wheel zoom + pan',
			label: 'Image preview',
			preview: 'Image preview: {name}',
			loading: 'Loading image...',
			failed: 'This image could not be displayed.',
			unsupported: 'Image preview requires the complete file contents.',
			controls: 'Zoom and pan controls',
			out: 'Zoom out',
			in: 'Zoom in',
			fit: 'Fit to pane',
			actual: '100%',
			hint: 'Wheel to zoom · hold left button to drag',
		};

		/** Zoom limits and the visual inset used when fitting. */
		const MIN_SCALE = 0.01;
		const MAX_SCALE = 8;
		const FIT_INSET = 12;

		/** Image suffixes and their Blob media types. */
		const EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg'];
		const BINARY_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico'];
		const MEDIA_TYPES = {
			png: 'image/png',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			gif: 'image/gif',
			webp: 'image/webp',
			bmp: 'image/bmp',
			ico: 'image/x-icon',
			svg: 'image/svg+xml',
		};

		/** Styles: a full-pane surface, a transformed image, and the floating toolbar. */
		const CSS = `
.dshImageWheelPan_viewport{position:relative;box-sizing:border-box;width:100%;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);cursor:grab;touch-action:none;user-select:none}
.dshImageWheelPan_grabbing{cursor:grabbing}
.dshImageWheelPan_image{position:absolute;top:0;left:0;max-width:none;max-height:none;transform-origin:0 0;user-select:none;-webkit-user-drag:none;will-change:transform;pointer-events:none}
.dshImageWheelPan_status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;text-align:center;pointer-events:none}
.dshImageWheelPan_hint{position:absolute;top:12px;left:12px;z-index:2;padding:4px 8px;border-radius:6px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px;pointer-events:none}
.dshImageWheelPan_toolbar{position:absolute;left:50%;bottom:12px;z-index:3;display:inline-flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 6px 20px color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:16px;transform:translateX(-50%);user-select:none}
.dshImageWheelPan_button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;height:24px;min-width:24px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}
.dshImageWheelPan_button:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent);color:var(--dsw-alias-label-primary)}
.dshImageWheelPan_button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dshImageWheelPan_value{min-width:44px;text-align:center;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
`;

		/** Last path segment of a resource address, decoded for the alt text. */
		function baseNameOf(address) {
			try {
				const path = new URL(address).pathname;
				const segment = path.slice(path.lastIndexOf('/') + 1);
				return decodeURIComponent(segment);
			} catch (error) {
				const segment = String(address).slice(String(address).lastIndexOf('/') + 1);
				try {
					return decodeURIComponent(segment);
				} catch (nested) {
					return segment;
				}
			}
		}

		/** Suffix after the last dot, lower-cased. */
		function extensionOf(name) {
			const dot = name.lastIndexOf('.');
			return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
		}

		/** Clamp a scale into the supported range. */
		function clampScale(value) {
			return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
		}

		/** Fit the whole image inside the pane, without enlarging images smaller than it. */
		function fitView(natural, viewport) {
			const availableWidth = Math.max(1, viewport.w - FIT_INSET * 2);
			const availableHeight = Math.max(1, viewport.h - FIT_INSET * 2);
			const scale = Math.min(1, availableWidth / Math.max(1, natural.w), availableHeight / Math.max(1, natural.h));
			const width = natural.w * scale;
			const height = natural.h * scale;
			const x = (viewport.w - width) / 2;
			const y = (viewport.h - height) / 2;
			return { scale, x, y };
		}

		return {
			inject: ['documentPreviews', 'slots', 'locale'],
			apply(ctx) {
				ctx.effect(() => {
					const tag = document.createElement('style');
					tag.setAttribute('data-plugin', PLUGIN_ID);
					tag.setAttribute('data-plugin-css', `${PLUGIN_ID}/image.css`);
					tag.textContent = CSS;
					document.head.appendChild(tag);
					return () => {
						tag.remove();
					};
				}, 'dsh-image-wheel-pan: stylesheet');

				ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-image-wheel-pan: dictionaries');
				const translate = ctx.locale.bind(NS);

				/**
				 * The image surface. All hooks run unconditionally; the unsupported
				 * branch is a render decision made after them.
				 */
				function WheelPanImage(props) {
					const content = props.content;
					const resourceAddress = props.resourceAddress;
					const tr = translate;
					const name = baseNameOf(resourceAddress);
					const mime = MEDIA_TYPES[extensionOf(name)];
					const data = content.kind === 'bytes' ? content.data : null;

					const [url, setUrl] = React.useState(null);
					const [natural, setNatural] = React.useState(null);
					const [size, setSize] = React.useState({ w: 0, h: 0 });
					const [viewportNode, setViewportNode] = React.useState(null);
					const [view, setView] = React.useState({ scale: 1, x: 0, y: 0, fit: true });
					const [dragging, setDragging] = React.useState(false);
					const [interacted, setInteracted] = React.useState(false);
					const [failed, setFailed] = React.useState(false);

					const viewportRef = React.useRef(null);
					const viewRef = React.useRef(view);
					const sizeRef = React.useRef(size);
					const naturalRef = React.useRef(natural);
					const dragRef = React.useRef(null);

					React.useLayoutEffect(() => {
						viewRef.current = view;
					}, [view]);
					React.useLayoutEffect(() => {
						sizeRef.current = size;
					}, [size]);
					React.useLayoutEffect(() => {
						naturalRef.current = natural;
					}, [natural]);

					const attachViewport = React.useCallback((node) => {
						viewportRef.current = node;
						setViewportNode(node);
						if (typeof props.scrollportRef === 'function') props.scrollportRef(node);
						if (node !== null) {
							const next = { w: node.clientWidth, h: node.clientHeight };
							sizeRef.current = next;
							setSize(next);
						}
					}, [props.scrollportRef]);

					React.useEffect(() => {
						const node = viewportNode;
						if (node === null) return;
						const measure = () => {
							const next = { w: node.clientWidth, h: node.clientHeight };
							sizeRef.current = next;
							setSize(next);
						};
						measure();
						if (typeof ResizeObserver === 'undefined') return;
						const observer = new ResizeObserver(measure);
						observer.observe(node);
						return () => {
							observer.disconnect();
						};
					}, [viewportNode]);

					React.useEffect(() => {
						if (data === null || mime === undefined) {
							setUrl(null);
							return;
						}
						let objectUrl;
						try {
							objectUrl = URL.createObjectURL(new Blob([data], { type: mime }));
						} catch (error) {
							setFailed(true);
							setUrl(null);
							return;
						}
						setUrl(objectUrl);
						setNatural(null);
						naturalRef.current = null;
						setFailed(false);
						setInteracted(false);
						const reset = { scale: 1, x: 0, y: 0, fit: true };
						viewRef.current = reset;
						setView(reset);
						return () => {
							URL.revokeObjectURL(objectUrl);
						};
					}, [data, mime]);

					React.useEffect(() => {
						if (!view.fit || natural === null || size.w <= 0 || size.h <= 0) return;
						const next = fitView(natural, size);
						const current = viewRef.current;
						if (current.fit && current.scale === next.scale && current.x === next.x && current.y === next.y) return;
						viewRef.current = { ...next, fit: true };
						setView(viewRef.current);
					}, [natural, size.w, size.h, view.fit]);

					React.useEffect(() => {
						const node = viewportNode;
						if (node === null) return;
						const onWheel = (event) => {
							if (event.deltaY === 0) return;
							event.preventDefault();
							event.stopPropagation();
							const current = viewRef.current;
							const bounds = node.getBoundingClientRect();
							const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1;
							const delta = Math.max(-60, Math.min(60, event.deltaY * unit));
							const nextScale = clampScale(current.scale * Math.exp(-delta * 0.002));
							if (nextScale === current.scale) return;
							const pointerX = event.clientX - bounds.left;
							const pointerY = event.clientY - bounds.top;
							const ratio = nextScale / current.scale;
							const next = {
								scale: nextScale,
								x: pointerX - (pointerX - current.x) * ratio,
								y: pointerY - (pointerY - current.y) * ratio,
								fit: false,
							};
							viewRef.current = next;
							setView(next);
							setInteracted(true);
						};
						node.addEventListener('wheel', onWheel, { passive: false });
						return () => {
							node.removeEventListener('wheel', onWheel);
						};
					}, [viewportNode]);

					function zoomBy(factor) {
						const current = viewRef.current;
						const nextScale = clampScale(current.scale * factor);
						if (nextScale === current.scale) return;
						const viewport = sizeRef.current;
						const centerX = viewport.w / 2;
						const centerY = viewport.h / 2;
						const ratio = nextScale / current.scale;
						const next = {
							scale: nextScale,
							x: centerX - (centerX - current.x) * ratio,
							y: centerY - (centerY - current.y) * ratio,
							fit: false,
						};
						viewRef.current = next;
						setView(next);
						setInteracted(true);
					}

					function fitNow() {
						const next = { ...viewRef.current, fit: true };
						viewRef.current = next;
						setView(next);
						setInteracted(true);
					}

					function actualSize() {
						const image = naturalRef.current;
						const viewport = sizeRef.current;
						if (image === null) return;
						const next = {
							scale: 1,
							x: (viewport.w - image.w) / 2,
							y: (viewport.h - image.h) / 2,
							fit: false,
						};
						viewRef.current = next;
						setView(next);
						setInteracted(true);
					}

					function onPointerDown(event) {
						if (event.button !== 0) return;
						const target = event.target;
						if (target !== null && typeof target.closest === 'function' && target.closest('[data-image-wheel-pan-toolbar]') !== null) return;
						event.preventDefault();
						try {
							event.currentTarget.setPointerCapture(event.pointerId);
						} catch (error) {
							/* pointer capture is best effort */
						}
						const current = viewRef.current;
						dragRef.current = {
							id: event.pointerId,
							startX: event.clientX,
							startY: event.clientY,
							x: current.x,
							y: current.y,
						};
						setDragging(true);
						setInteracted(true);
					}

					function onPointerMove(event) {
						const drag = dragRef.current;
						if (drag === null || drag.id !== event.pointerId) return;
						const next = {
							...viewRef.current,
							x: drag.x + event.clientX - drag.startX,
							y: drag.y + event.clientY - drag.startY,
							fit: false,
						};
						viewRef.current = next;
						setView(next);
					}

					function endDrag(event) {
						const drag = dragRef.current;
						if (drag === null || drag.id !== event.pointerId) return;
						dragRef.current = null;
						setDragging(false);
						try {
							if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
						} catch (error) {
							/* pointer capture is best effort */
						}
					}

					function onLoad(event) {
						const image = {
							w: event.currentTarget.naturalWidth || 300,
							h: event.currentTarget.naturalHeight || 150,
						};
						naturalRef.current = image;
						setNatural(image);
						setView((previous) => ({ ...previous, fit: true }));
					}

					if (content.kind !== 'bytes' || mime === undefined) {
						return h('div', { className: 'dshImageWheelPan_status', role: 'alert' }, tr('unsupported'));
					}

					const button = (label, title, action) => h('button', {
						type: 'button',
						className: 'dshImageWheelPan_button',
						title,
						'aria-label': title,
						onClick: action,
					}, label);

					return h(
						'div',
						{
							ref: attachViewport,
							className: `dshImageWheelPan_viewport${dragging ? ' dshImageWheelPan_grabbing' : ''}`,
							role: 'region',
							'aria-label': tr('label'),
							onPointerDown,
							onPointerMove,
							onPointerUp: endDrag,
							onPointerCancel: endDrag,
							onLostPointerCapture: endDrag,
							onDoubleClick: fitNow,
						},
						url !== null && h('img', {
							src: url,
							alt: tr('preview', { name }),
							className: 'dshImageWheelPan_image',
							draggable: false,
							decoding: 'async',
							referrerPolicy: 'no-referrer',
							onLoad,
							onError: () => {
								setFailed(true);
							},
							style: {
								width: natural === null ? undefined : natural.w,
								height: natural === null ? undefined : natural.h,
								opacity: natural === null ? 0 : 1,
								transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
							},
						}),
						natural === null && !failed && h('div', { className: 'dshImageWheelPan_status', role: 'status' }, tr('loading')),
						failed && h('div', { className: 'dshImageWheelPan_status', role: 'alert' }, tr('failed')),
						!interacted && !failed && h('div', { className: 'dshImageWheelPan_hint' }, tr('hint')),
						h(
							'div',
							{
								className: 'dshImageWheelPan_toolbar',
								'data-image-wheel-pan-toolbar': '',
								role: 'toolbar',
								'aria-label': tr('controls'),
								onPointerDown: (event) => {
									event.stopPropagation();
								},
								onDoubleClick: (event) => {
									event.stopPropagation();
								},
							},
							button('−', tr('out'), () => {
								zoomBy(1 / 1.25);
							}),
							h('span', { className: 'dshImageWheelPan_value', 'aria-live': 'polite' }, `${Math.round(view.scale * 100)}%`),
							button('+', tr('in'), () => {
								zoomBy(1.25);
							}),
							button(tr('fit'), tr('fit'), fitNow),
							button(tr('actual'), tr('actual'), actualSize),
						),
					);
				}

				ctx.effect(() => ctx.documentPreviews.register({
					id: BODY_ID,
					extensions: EXTENSIONS,
					binaryExtensions: BINARY_EXTENSIONS,
					priority: 'extension',
					title: () => translate('renderer'),
					loading: 'bytes-complete',
					wrap: false,
				}), 'dsh-image-wheel-pan: renderer metadata');

				ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
					name: 'sidebar.right.tab.document',
					key: BODY_ID,
					locale: NS,
				}, WheelPanImage)), 'dsh-image-wheel-pan: image body');
			},
		};
	},
});
