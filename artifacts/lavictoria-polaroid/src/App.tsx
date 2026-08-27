import { useEffect, useRef, useState } from 'react';
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
const DEFAULT_CAPTION = 'a little moment';
const MAX_CAPTION_LENGTH = 42;

type ImageFile = {
  file: File;
  url: string;
};

function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<ImageFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [caption, setCaption] = useState(DEFAULT_CAPTION);

  useEffect(() => {
    return () => {
      if (image?.url) URL.revokeObjectURL(image.url);
    };
  }, [image]);

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
    setDownloaded(false);
    setError('');
  };

  const downloadPolaroid = async () => {
    if (!image || isLoading) return;
    setError('');

    try {
      const source = new window.Image();
      source.src = image.url;
      await source.decode();

      const canvas = document.createElement('canvas');
      const frameWidth = 1200;
      const photoSize = 1020;
      const sideInset = 90;
      const topInset = 90;
      const captionHeight = 230;
      canvas.width = frameWidth;
      canvas.height = topInset + photoSize + captionHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');

      context.fillStyle = '#f8f5ed';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#dfd2bf';
      context.fillRect(sideInset, topInset, photoSize, photoSize);

      const scale = Math.max(photoSize / source.naturalWidth, photoSize / source.naturalHeight);
      const drawWidth = source.naturalWidth * scale;
      const drawHeight = source.naturalHeight * scale;
      context.drawImage(
        source,
        sideInset + (photoSize - drawWidth) / 2,
        topInset + (photoSize - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );

      context.fillStyle = '#493c35';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '500 52px Georgia, serif';
      context.fillText(
        caption.trim() || DEFAULT_CAPTION,
        frameWidth / 2,
        topInset + photoSize + captionHeight / 2,
        photoSize,
      );

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
                <div className="polaroid" data-testid="preview-polaroid">
                  <div className="polaroid-photo">
                    <img
                      src={image.url}
                      alt={`Preview of ${image.file.name}`}
                      onLoad={() => setIsLoading(false)}
                      onError={() => {
                        setIsLoading(false);
                        setError('That image could not be read. Please choose another photo.');
                      }}
                      data-testid="img-photo-preview"
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
                  </div>
                  <div className="polaroid-caption" data-testid="text-polaroid-caption">
                    {caption.trim() || DEFAULT_CAPTION}
                  </div>
                </div>
              ) : (
                <div className="empty-polaroid" data-testid="empty-preview-state">
                  <div className="empty-photo">
                    <span className="empty-photo-mark" aria-hidden="true">
                      <Camera size={22} strokeWidth={1.5} />
                    </span>
                  </div>
                  <div className="empty-caption">{caption.trim() || DEFAULT_CAPTION}</div>
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
              {image ? 'A PNG matching the frame you see above.' : 'Choose a photo to unlock the download.'}
            </p>
          </section>
        </div>

        <div className="footer-line" data-testid="text-footer">one photo · one keepsake · made locally</div>
      </main>
    </div>
  );
}

export default Home;