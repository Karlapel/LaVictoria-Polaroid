import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  Download,
  FileImage,
  Image as ImageIcon,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_CAPTION_LENGTH = 42;
const FRAME_WIDTH = 1200;

const FORMAT_CONFIG = {
  square: {
    label: 'Square',
    ratioLabel: '1:1 photo',
    photoWidth: 1020,
    photoHeight: 1020,
    sideInset: 90,
    topInset: 90,
    captionHeight: 230,
  },
  classic: {
    label: 'Classic Polaroid',
    ratioLabel: '4:3 photo',
    photoWidth: 1020,
    photoHeight: 765,
    sideInset: 90,
    topInset: 90,
    captionHeight: 230,
  },
  vertical: {
    label: 'Vertical',
    ratioLabel: '4:5 photo',
    photoWidth: 900,
    photoHeight: 1125,
    sideInset: 150,
    topInset: 90,
    captionHeight: 230,
  },
} as const;

type PolaroidFormat = keyof typeof FORMAT_CONFIG;
type FormatConfig = (typeof FORMAT_CONFIG)[PolaroidFormat];

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
  width: number;
  height: number;
};

function getPanLimits(
  source: HTMLImageElement,
  formatConfig: FormatConfig,
  zoom: number,
) {
  const baseScale = Math.max(
    formatConfig.photoWidth / source.naturalWidth,
    formatConfig.photoHeight / source.naturalHeight,
  );
  const drawWidth = source.naturalWidth * baseScale * zoom;
  const drawHeight = source.naturalHeight * baseScale * zoom;

  return {
    x: Math.max(0, (drawWidth - formatConfig.photoWidth) / 2),
    y: Math.max(0, (drawHeight - formatConfig.photoHeight) / 2),
  };
}

function drawPhotoCrop(
  context: CanvasRenderingContext2D,
  source: HTMLImageElement,
  formatConfig: FormatConfig,
  zoom: number,
  panX: number,
  panY: number,
) {
  const baseScale = Math.max(
    formatConfig.photoWidth / source.naturalWidth,
    formatConfig.photoHeight / source.naturalHeight,
  );
  const drawWidth = source.naturalWidth * baseScale * zoom;
  const drawHeight = source.naturalHeight * baseScale * zoom;
  const panLimits = getPanLimits(source, formatConfig, zoom);
  const offsetX = (panX / 100) * panLimits.x;
  const offsetY = (panY / 100) * panLimits.y;
  const drawX = (formatConfig.photoWidth - drawWidth) / 2 + offsetX;
  const drawY = (formatConfig.photoHeight - drawHeight) / 2 + offsetY;

  context.save();
  context.beginPath();
  context.rect(0, 0, formatConfig.photoWidth, formatConfig.photoHeight);
  context.clip();
  context.drawImage(source, drawX, drawY, drawWidth, drawHeight);
  context.restore();
}

type ImageFile = {
  file: File;
  url: string;
};

function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [image, setImage] = useState<ImageFile | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [caption, setCaption] = useState('');
  const [format, setFormat] = useState<PolaroidFormat>('classic');
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const displayCaption = caption.trim();
  const formatConfig = FORMAT_CONFIG[format];
  const frameStyle = {
    '--frame-side': `${(formatConfig.sideInset / FRAME_WIDTH) * 100}%`,
    '--frame-top': `${(formatConfig.topInset / FRAME_WIDTH) * 100}%`,
    '--photo-ratio': `${formatConfig.photoWidth} / ${formatConfig.photoHeight}`,
    '--caption-ratio': `${formatConfig.photoWidth} / ${formatConfig.captionHeight}`,
  } as CSSProperties;

  useEffect(() => {
    return () => {
      if (image?.url) URL.revokeObjectURL(image.url);
    };
  }, [image]);

  useEffect(() => {
    setSourceImage(null);
    if (!image) return;

    let cancelled = false;
    const nextImage = new window.Image();
    nextImage.onload = () => {
      if (cancelled) return;
      setSourceImage(nextImage);
      setIsLoading(false);
    };
    nextImage.onerror = () => {
      if (cancelled) return;
      setIsLoading(false);
      setError('That image could not be read. Please choose another photo.');
    };
    nextImage.src = image.url;

    return () => {
      cancelled = true;
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [image]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = formatConfig.photoWidth;
    canvas.height = formatConfig.photoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#d8c7ae';
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (sourceImage) {
      drawPhotoCrop(context, sourceImage, formatConfig, zoom, panX, panY);
    }
  }, [formatConfig, panX, panY, sourceImage, zoom]);

  const validateAndLoad = (file?: File) => {
    if (!file) return;
    setDownloaded(false);
    setError('');

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('That file type will not work here. Choose a JPG, PNG, WEBP, or GIF image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('That photo is a little too large. Please choose an image under 20 MB.');
      return;
    }

    setIsLoading(true);
    setZoom(1);
    setPanX(0);
    setPanY(0);
    const nextUrl = URL.createObjectURL(file);
    setImage((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return { file, url: nextUrl };
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    validateAndLoad(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    validateAndLoad(event.dataTransfer.files?.[0]);
  };

  const resetImage = () => {
    if (image?.url) URL.revokeObjectURL(image.url);
    setImage(null);
    setIsLoading(false);
    setSourceImage(null);
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setDownloaded(false);
    setError('');
  };

  const updateZoom = (nextZoom: number) => {
    setZoom(Math.min(3, Math.max(1, nextZoom)));
    setDownloaded(false);
  };

  const handlePhotoPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!sourceImage || (event.target as HTMLElement).closest('button, input')) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: panX,
      startPanY: panY,
      width: bounds.width,
      height: bounds.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePhotoPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !sourceImage) return;

    const panLimits = getPanLimits(sourceImage, formatConfig, zoom);
    const displayedLimitX = panLimits.x * (drag.width / formatConfig.photoWidth);
    const displayedLimitY = panLimits.y * (drag.height / formatConfig.photoHeight);
    const deltaX = displayedLimitX ? ((event.clientX - drag.startX) / displayedLimitX) * 100 : 0;
    const deltaY = displayedLimitY ? ((event.clientY - drag.startY) / displayedLimitY) * 100 : 0;

    setPanX(Math.min(100, Math.max(-100, drag.startPanX + deltaX)));
    setPanY(Math.min(100, Math.max(-100, drag.startPanY + deltaY)));
    setDownloaded(false);
  };

  const finishPhotoDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const downloadPolaroid = async () => {
    if (!image || !sourceImage || isLoading) return;
    setError('');

    try {
      const canvas = document.createElement('canvas');
      const {
        photoWidth,
        photoHeight,
        sideInset,
        topInset,
        captionHeight,
      } = formatConfig;
      canvas.width = FRAME_WIDTH;
      canvas.height = topInset + photoHeight + captionHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');

      context.fillStyle = '#f8f5ed';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#dfd2bf';
      context.fillRect(sideInset, topInset, photoWidth, photoHeight);

      context.save();
      context.translate(sideInset, topInset);
      drawPhotoCrop(context, sourceImage, formatConfig, zoom, panX, panY);
      context.restore();

      if (displayCaption) {
        context.fillStyle = '#493c35';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = '500 52px Georgia, serif';
        context.fillText(
          displayCaption,
          FRAME_WIDTH / 2,
          topInset + photoHeight + captionHeight / 2,
          photoWidth,
        );
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not make the image');

      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = 'lavictoria-polaroid.png';
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 2600);
    } catch {
      setError('We could not prepare that photo. Try choosing it again.');
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="wordmark" data-testid="text-brand">
          <span className="wordmark-mark" aria-hidden="true">
            <Camera size={15} strokeWidth={1.7} />
          </span>
          LaVictoria Polaroid
        </div>
        <div className="topbar-note" data-testid="text-local-processing">made for keeping</div>
      </header>

      <main className="main-content">
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow"><Sparkles size={13} strokeWidth={2} /> a small photo ritual</p>
          <h1 id="page-title">Make a little <em>keepsake.</em></h1>
          <p className="intro-copy">
            Turn one favorite photo into a classic Polaroid-style print, ready to save and keep close.
          </p>
        </section>

        <div className="workspace">
          <section className="control-column" aria-labelledby="upload-heading">
            <h2 className="section-label" id="upload-heading">01 / Choose a photo</h2>
            <label
              className={`drop-zone${isDragging ? ' is-dragging' : ''}`}
              htmlFor="photo-upload"
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              data-testid="dropzone-photo"
            >
              <input
                ref={fileInputRef}
                id="photo-upload"
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleFileChange}
                data-testid="input-photo-upload"
              />
              <span className="upload-seal" aria-hidden="true">
                <Upload size={22} strokeWidth={1.8} />
              </span>
              <h3 className="drop-title">Bring a moment in</h3>
              <p className="drop-caption">Drop a photo here, or choose one from your camera roll.</p>
              <span className="browse-button" role="button" aria-label="Choose a photo from your device" data-testid="button-choose-photo">
                <ImageIcon size={16} />
                Browse files
              </span>
              <p className="file-note"><FileImage size={13} /> JPG, PNG, WEBP, or GIF · up to 20 MB</p>
            </label>

            <div className="format-field">
              <div className="format-field-header">
                <label className="format-label">Polaroid format</label>
                <span className="format-hint">choose your frame shape</span>
              </div>
              <div className="format-options" role="radiogroup" aria-label="Polaroid format">
                {(Object.keys(FORMAT_CONFIG) as PolaroidFormat[]).map((option) => {
                  const optionConfig = FORMAT_CONFIG[option];
                  const isSelected = option === format;

                  return (
                    <button
                      key={option}
                      className={`format-option${isSelected ? ' is-selected' : ''}`}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setFormat(option);
                        setDownloaded(false);
                      }}
                      data-testid={`button-format-${option}`}
                    >
                      <span className={`format-swatch format-swatch-${option}`} aria-hidden="true" />
                      <span className="format-option-copy">
                        <strong>{optionConfig.label}</strong>
                        <small>{optionConfig.ratioLabel}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="caption-field">
              <div className="caption-field-header">
                <label className="caption-label" htmlFor="polaroid-caption">
                  Add a caption
                </label>
                <span className="caption-hint">name, date, or a little note</span>
              </div>
              <div className="caption-input-wrap">
                <input
                  id="polaroid-caption"
                  type="text"
                  value={caption}
                  maxLength={MAX_CAPTION_LENGTH}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="e.g. August 2026"
                  data-testid="input-polaroid-caption"
                />
                <span className="caption-count" aria-hidden="true">
                  {caption.length}/{MAX_CAPTION_LENGTH}
                </span>
              </div>
            </div>

            {error && (
              <div className="error-message" role="alert" aria-live="polite" data-testid="status-upload-error">
                <AlertCircle size={17} aria-hidden="true" />
                <span>{error}</span>
                <button
                  className="error-dismiss"
                  type="button"
                  aria-label="Dismiss error"
                  onClick={() => setError('')}
                  data-testid="button-dismiss-error"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="privacy-note" data-testid="text-privacy-note">
              <LockKeyhole size={17} strokeWidth={1.7} aria-hidden="true" />
              <span>
                <strong>Just between us.</strong>
                Your photo stays in this browser. Nothing is uploaded anywhere.
              </span>
            </div>
          </section>

          <section className="preview-column" aria-labelledby="preview-heading">
            <div className="preview-header">
              <h2 className="section-label" id="preview-heading">02 / Your keepsake</h2>
              {image && (
                <button
                  className="reset-button"
                  type="button"
                  onClick={resetImage}
                  data-testid="button-reset-photo"
                >
                  <RotateCcw size={13} />
                  Start over
                </button>
              )}
            </div>

            <div
              className="polaroid-stage"
              data-testid="preview-stage"
              aria-live="polite"
              aria-busy={isLoading}
            >
              {image ? (
                <div className="polaroid" style={frameStyle} data-testid="preview-polaroid">
                  <div
                    className={`polaroid-photo${sourceImage ? ' is-framable' : ''}`}
                    onPointerDown={handlePhotoPointerDown}
                    onPointerMove={handlePhotoPointerMove}
                    onPointerUp={finishPhotoDrag}
                    onPointerCancel={finishPhotoDrag}
                  >
                    <canvas
                      ref={canvasRef}
                      role="img"
                      aria-label={`Preview of ${image.file.name}`}
                      data-testid="canvas-photo-preview"
                    />
                    {isLoading && (
                      <div
                        className="loading-overlay"
                        data-testid="status-image-loading"
                        role="status"
                        aria-label="Loading photo preview"
                      >
                        <div className="loading-spinner" />
                      </div>
                    )}
                    {sourceImage && (
                      <div
                        className="framing-controls"
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <span className="framing-hint">Drag to frame</span>
                        <div className="framing-slider-row">
                          <button
                            className="zoom-button"
                            type="button"
                            onClick={() => updateZoom(zoom - 0.1)}
                            aria-label="Zoom out"
                            data-testid="button-zoom-out"
                          >
                            −
                          </button>
                          <input
                            type="range"
                            min="1"
                            max="3"
                            step="0.01"
                            value={zoom}
                            onChange={(event) => updateZoom(Number(event.target.value))}
                            aria-label="Photo zoom"
                            data-testid="input-photo-zoom"
                          />
                          <button
                            className="zoom-button"
                            type="button"
                            onClick={() => updateZoom(zoom + 0.1)}
                            aria-label="Zoom in"
                            data-testid="button-zoom-in"
                          >
                            +
                          </button>
                          <span className="zoom-value">{Math.round(zoom * 100)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="polaroid-caption" data-testid="text-polaroid-caption">
                    {displayCaption}
                  </div>
                </div>
              ) : (
                <div className="empty-polaroid" style={frameStyle} data-testid="empty-preview-state">
                  <div className="empty-photo">
                    <span className="empty-photo-mark" aria-hidden="true">
                      <Camera size={22} strokeWidth={1.5} />
                    </span>
                  </div>
                  <div className="empty-caption">{displayCaption}</div>
                </div>
              )}
            </div>

            <button
              className={`download-button${downloaded ? ' is-done' : ''}`}
              type="button"
              disabled={!image || isLoading}
              onClick={downloadPolaroid}
              data-testid="button-download-polaroid"
            >
              {downloaded ? <Check size={17} /> : <Download size={17} />}
              {downloaded ? 'Saved to your downloads' : 'Download your Polaroid'}
            </button>
            <p className="shortcut" data-testid="text-download-hint">
              {image ? `A PNG matching the ${formatConfig.label} frame you see above.` : 'Choose a photo to unlock the download.'}
            </p>
          </section>
        </div>

        <div className="footer-line" data-testid="text-footer">one photo · one keepsake · made locally</div>
      </main>
    </div>
  );
}

export default Home;