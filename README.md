# Image Wheel Zoom & Pan

A DSH Web client plugin that adds direct wheel zoom and left-drag panning to
images opened in the right sidebar.

The built-in image preview supports the zoom buttons and `Ctrl`+wheel; this
plugin registers an `extension`-band image renderer so the same files open with:

| Gesture | Result |
|---|---|
| Mouse wheel over the image | Zoom around the pointer, 1%–800% |
| Hold left mouse button and drag | Pan the image; the cursor becomes a grab hand |
| Double-click | Fit the image to the pane |
| Bottom toolbar | `−` / percentage / `+` / **Fit** / **100%** |

PNG, JPEG, GIF, WebP, BMP, ICO and SVG are handled. SVG stays in the browser's
static `<img>` mode; its scripts never execute.

## Install

This is an ordinary DSH **profile bundle**: plain ESM, no build step, no runtime
dependencies.

### From the DSH Plugins page

1. Open **Plugins** in the DSH sidebar.
2. Choose **Add plugin**, paste the repository address, and install:

   ```
   https://github.com/jinmuxi1/dsh-image-wheel-pan
   ```

   If the field asks for a Git spec, use
   `git+https://github.com/jinmuxi1/dsh-image-wheel-pan.git`.
3. If the Web UI was already open, refresh the page once (`Ctrl`/`⌘` + `R`).

### From a local checkout

```bash
git clone https://github.com/jinmuxi1/dsh-image-wheel-pan.git
```

Then ask the Harness agent:

```
plugin_manager  action: install_bundle
                target: <absolute path to the cloned directory>
```

## Use

Open an image in the right sidebar. New image tabs select this renderer
automatically. A tab that already used the built-in image viewer can switch from
the dropdown in the preview header to **Image Wheel Zoom & Pan**.

- Scroll over the image to zoom; no Ctrl is required.
- Hold the left mouse button and drag to pan.
- Double-click, or press **Fit**, to fit the whole image to the pane.
- **100%** shows the image at its intrinsic CSS-pixel size.

## Notes

- Pan/zoom is transient per mounted preview; closing or reloading the tab resets
  it to fit.
- The viewer owns the image surface: wheel events over it do not scroll the
  right pane.
- The renderer only reads the image bytes the preview already loaded; it makes
  no additional file or network request.

## Files

| File | Role |
|---|---|
| `index.js` | Host half: empty `apply()` |
| `client.js` | Registers the image renderer and draws the zoom/pan surface |
| `cordis.patch.yml` | Inserts the `dsh-image-wheel-pan` row |
| `locale/{zh,en}.json` | Plugin-card title/description |
| `scripts/check.mjs` | Manifest and syntax checks |

## License

MIT — see [LICENSE](LICENSE).

## 中文说明

在右侧文件预览里打开 PNG/JPEG/GIF/WebP/BMP/ICO/SVG 后：

- 直接滚动鼠标滚轮即可缩放（不需要按 Ctrl），以鼠标位置为中心；
- 按住鼠标左键拖动即可平移，光标会变成抓取手形；
- 双击图片或点底部的 **Fit** 恢复适应窗口；**100%** 恢复原始像素比例。

安装：在 DSH 的 **Plugins → Add plugin** 里粘贴仓库地址
`https://github.com/jinmuxi1/dsh-image-wheel-pan` 安装；安装后如果页面已经打开，刷新一次。
新开的图片标签会自动使用这个渲染器；已经打开的图片标签可以在预览顶部下拉框中切换到
**图片滚轮缩放与拖动**。
