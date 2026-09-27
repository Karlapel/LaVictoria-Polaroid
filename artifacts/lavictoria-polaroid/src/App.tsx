import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  Download,
  FileImage,
  Image as ImageIcon,
  Images,
  LockKeyhole,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
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

type FramingState = {
  zoom: number;
  panX: number;
  panY: number;
};

type MultiPhoto = ImageFile & FramingState & {
  id: string;
  sourceImage: HTMLImageElement | null;
  isLoading: boolean;
  caption: string;
};

type AppMode = 'single' | 'multiple';
type MultipleMode = 'each' | 'repeat';

const makePhotoId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function renderPolaroidBlob(
  sourceImage: HTMLImageElement,
  formatConfig: FormatConfig,
  framing: FramingState,
  caption: string,
) {
  const canvas = document.createElement('canvas');
  drawPolaroidCanvas(canvas, sourceImage, formatConfig, framing, caption);

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function drawPolaroidCanvas(
  canvas: HTMLCanvasElement,
  sourceImage: HTMLImageElement | null,
  formatConfig: FormatConfig,
  framing: FramingState,
  caption: string,
) {
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

  if (sourceImage) {
    context.save();
    context.translate(sideInset, topInset);
    drawPhotoCrop(
      context,
      sourceImage,
      formatConfig,
      framing.zoom,
      framing.panX,
      framing.panY,
    );
    context.restore();
  }

  if (caption) {
    context.fillStyle = '#493c35';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '500 52px Georgia, serif';
    context.fillText(
      caption,
      FRAME_WIDTH / 2,
      topInset + photoHeight + captionHeight / 2,
      photoWidth,
    );
  }
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_QUANTITIES = [4, 6, 9, 12] as const;
type A4Quantity = (typeof A4_QUANTITIES)[number];

type MountPhoto = {
  id: string;
  fileName: string;
  sourceImage: HTMLImageElement | null;
  zoom: number;
  panX: number;
  panY: number;
  caption: string;
};

type A4Placement = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type A4Layout = {
  columns: number;
  rows: number;
  margin: number;
  gap: number;
  placements: A4Placement[];
};

function getA4Layout(quantity: A4Quantity, formatConfig: FormatConfig): A4Layout {
  const candidates: Record<A4Quantity, Array<[number, number]>> = {
    4: [[2, 2], [1, 4], [4, 1]],
    6: [[2, 3], [3, 2], [1, 6], [6, 1]],
    9: [[3, 3]],
    12: [[3, 4], [4, 3], [2, 6], [6, 2]],
  };
  const margin = quantity === 4 ? 16 : quantity === 6 ? 13 : quantity === 9 ? 10 : 8;
  const gap = quantity === 4 ? 8 : quantity === 6 ? 6 : quantity === 9 ? 5 : 4;
  const frameRatio = FRAME_WIDTH / (formatConfig.topInset + formatConfig.photoHeight + formatConfig.captionHeight);

  const bestGrid = candidates[quantity].reduce((best, [columns, rows]) => {
    const cellWidth = (A4_WIDTH_MM - margin * 2 - gap * (columns - 1)) / columns;
    const cellHeight = (A4_HEIGHT_MM - margin * 2 - gap * (rows - 1)) / rows;
    const cardWidth = Math.min(cellWidth, cellHeight * frameRatio);
    const score = cardWidth * (cardWidth / frameRatio);
    return score > best.score ? { columns, rows, score } : best;
  }, { columns: candidates[quantity][0][0], rows: candidates[quantity][0][1], score: -1 });

  const { columns, rows } = bestGrid;
  const innerWidth = A4_WIDTH_MM - margin * 2;
  const innerHeight = A4_HEIGHT_MM - margin * 2;
  const cellWidth = (innerWidth - gap * (columns - 1)) / columns;
  const cellHeight = (innerHeight - gap * (rows - 1)) / rows;
  const cardWidth = Math.min(cellWidth, cellHeight * frameRatio);
  const cardHeight = cardWidth / frameRatio;
  const placements = Array.from({ length: quantity }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      left: margin + column * (cellWidth + gap) + (cellWidth - cardWidth) / 2,
      top: margin + row * (cellHeight + gap) + (cellHeight - cardHeight) / 2,
      width: cardWidth,
      height: cardHeight,
    };
  });

  return { columns, rows, margin, gap, placements };
}

function A4PolaroidCanvas({
  photo,
  formatConfig,
}: {
  photo: MountPhoto;
  formatConfig: FormatConfig;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = formatConfig.photoWidth;
    canvas.height = formatConfig.photoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#d8c7ae';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (photo.sourceImage) {
      drawPhotoCrop(
        context,
        photo.sourceImage,
        formatConfig,
        photo.zoom,
        photo.panX,
        photo.panY,
      );
    }
  }, [formatConfig, photo.caption, photo.panX, photo.panY, photo.sourceImage, photo.zoom]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`A4 preview of ${photo.fileName}`}
    />
  );
}

function A4PagePreview({
  items,
  pageNumber,
  totalPages,
  quantity,
  formatConfig,
}: {
  items: MountPhoto[];
  pageNumber: number;
  totalPages: number;
  quantity: A4Quantity;
  formatConfig: FormatConfig;
}) {
  const layout = getA4Layout(quantity, formatConfig);
  const frameStyle = {
    '--a4-frame-side': `${(formatConfig.sideInset / FRAME_WIDTH) * 100}%`,
    '--a4-frame-top': `${(formatConfig.topInset / FRAME_WIDTH) * 100}%`,
    '--a4-photo-ratio': `${formatConfig.photoWidth} / ${formatConfig.photoHeight}`,
    '--a4-caption-ratio': `${formatConfig.photoWidth} / ${formatConfig.captionHeight}`,
    '--a4-frame-ratio': `${FRAME_WIDTH} / ${formatConfig.topInset + formatConfig.photoHeight + formatConfig.captionHeight}`,
  } as CSSProperties;

  return (
    <article className="a4-page-card" data-testid={`a4-page-preview-${pageNumber}`}>
      <div className="a4-page-surface" aria-label={`A4 sheet ${pageNumber} of ${totalPages}`}>
        {items.map((photo, index) => {
          const placement = layout.placements[index];
          return (
            <div
              className="a4-polaroid"
              key={`${photo.id}-${pageNumber}-${index}`}
              style={{
                ...frameStyle,
                left: `${(placement.left / A4_WIDTH_MM) * 100}%`,
                top: `${(placement.top / A4_HEIGHT_MM) * 100}%`,
                width: `${(placement.width / A4_WIDTH_MM) * 100}%`,
                height: `${(placement.height / A4_HEIGHT_MM) * 100}%`,
              }}
            >
              <div className="a4-polaroid-photo">
                <A4PolaroidCanvas photo={photo} formatConfig={formatConfig} />
              </div>
              <div className="a4-polaroid-caption">{photo.caption.trim()}</div>
            </div>
          );
        })}
      </div>
      <div className="a4-page-meta">
        <span>Page {pageNumber} of {totalPages}</span>
        <span>A4 · 210 × 297 mm</span>
      </div>
    </article>
  );
}

function A4MountingStage({
  items,
  formatConfig,
}: {
  items: MountPhoto[];
  formatConfig: FormatConfig;
}) {
  const [quantity, setQuantity] = useState<A4Quantity>(6);
  const pageCount = Math.max(1, Math.ceil(items.length / quantity));
  const pages = Array.from({ length: pageCount }, (_, pageIndex) => (
    items.slice(pageIndex * quantity, (pageIndex + 1) * quantity)
  ));

  return (
    <section className="a4-mounting-stage" aria-labelledby="a4-mounting-heading" data-testid="a4-mounting-stage">
      <div className="a4-mounting-header">
        <div>
          <p className="eyebrow a4-eyebrow">04 / Print mounting</p>
          <h2 id="a4-mounting-heading">Set the keepsakes on A4.</h2>
          <p className="a4-mounting-copy">
            A true A4 sheet, balanced for trimming. Your current framing, captions, and photo order are carried through automatically.
          </p>
        </div>
        <div className="a4-page-count" data-testid="text-a4-page-count">
          <strong>{pageCount}</strong>
          <span>{pageCount === 1 ? 'sheet' : 'sheets'} to review</span>
        </div>
      </div>

      <div className="a4-quantity-field">
        <span className="format-label">Polaroids per sheet</span>
        <div className="a4-quantity-options" role="radiogroup" aria-label="Polaroids per A4 sheet">
          {A4_QUANTITIES.map((option) => (
            <button
              className={`a4-quantity-option${quantity === option ? ' is-selected' : ''}`}
              type="button"
              role="radio"
              aria-checked={quantity === option}
              onClick={() => setQuantity(option)}
              data-testid={`button-a4-quantity-${option}`}
              key={option}
            >
              <strong>{option}</strong>
              <small>per sheet</small>
            </button>
          ))}
        </div>
      </div>

      <div className="a4-page-gallery">
        {pages.map((pageItems, pageIndex) => (
          <A4PagePreview
            key={`a4-page-${pageIndex + 1}-${quantity}`}
            items={pageItems}
            pageNumber={pageIndex + 1}
            totalPages={pageCount}
            quantity={quantity}
            formatConfig={formatConfig}
          />
        ))}
      </div>
    </section>
  );
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(downloadUrl);
}

function MiniPolaroidPreview({
  photo,
  formatConfig,
  index,
  isSelected,
  onSelect,
}: {
  photo: MultiPhoto;
  formatConfig: FormatConfig;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = formatConfig.photoWidth;
    canvas.height = formatConfig.photoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = '#d8c7ae';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (photo.sourceImage) {
      drawPhotoCrop(
        context,
        photo.sourceImage,
        formatConfig,
        photo.zoom,
        photo.panX,
        photo.panY,
      );
    }
  }, [formatConfig, photo.panX, photo.panY, photo.sourceImage, photo.zoom]);

  const frameStyle = {
    '--mini-photo-ratio': `${formatConfig.photoWidth} / ${formatConfig.photoHeight}`,
    '--mini-caption-ratio': `${formatConfig.photoWidth} / ${formatConfig.captionHeight}`,
  } as CSSProperties;

  return (
    <button
      className={`mini-polaroid-preview${isSelected ? ' is-selected' : ''}`}
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      data-testid={`button-preview-photo-${photo.id}`}
    >
      <span className="mini-polaroid-frame" style={frameStyle}>
        <span className="mini-polaroid-photo">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Preview of photo ${index + 1}`}
          />
          <span className="mini-photo-number">{String(index + 1).padStart(2, '0')}</span>
        </span>
        <span className="mini-polaroid-caption">{photo.caption.trim()}</span>
      </span>
    </button>
  );
}

function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multipleFileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const multiPhotosRef = useRef<MultiPhoto[]>([]);
  const [appMode, setAppMode] = useState<AppMode>('single');
  const [image, setImage] = useState<ImageFile | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [multiPhotos, setMultiPhotos] = useState<MultiPhoto[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [multipleMode, setMultipleMode] = useState<MultipleMode>('each');
  const [repeatCount, setRepeatCount] = useState(2);
  const [isLoading, setIsLoading] = useState(false);
  const [isMultiLoading, setIsMultiLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [multiDownloaded, setMultiDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [caption, setCaption] = useState('');
  const [format, setFormat] = useState<PolaroidFormat>('classic');
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const formatConfig = FORMAT_CONFIG[format];
  const activePhoto = multiPhotos.find((photo) => photo.id === activePhotoId) ?? multiPhotos[0] ?? null;
  const displayCaption = (appMode === 'single' ? caption : activePhoto?.caption ?? '').trim();
  const previewSourceImage = appMode === 'single' ? sourceImage : activePhoto?.sourceImage ?? null;
  const previewZoom = appMode === 'single' ? zoom : activePhoto?.zoom ?? 1;
  const previewPanX = appMode === 'single' ? panX : activePhoto?.panX ?? 0;
  const previewPanY = appMode === 'single' ? panY : activePhoto?.panY ?? 0;
  const hasPhotos = appMode === 'single' ? Boolean(image) : multiPhotos.length > 0;
  const allMultiPhotosReady = multiPhotos.length > 0
    && multiPhotos.every((photo) => photo.sourceImage && !photo.isLoading);
  multiPhotosRef.current = multiPhotos;
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
    return () => {
      multiPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

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

    if (previewSourceImage) {
      drawPhotoCrop(context, previewSourceImage, formatConfig, previewZoom, previewPanX, previewPanY);
    }
  }, [formatConfig, previewPanX, previewPanY, previewSourceImage, previewZoom]);

  const switchMode = (nextMode: AppMode) => {
    setAppMode(nextMode);
    setDownloaded(false);
    setMultiDownloaded(false);
    setError('');
  };

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

  const validateAndLoadMultiple = (files: File[], append = false) => {
    if (files.length === 0) return;

    setMultiDownloaded(false);
    setError('');
    const validFiles: File[] = [];
    const rejectedFiles: string[] = [];

    files.forEach((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        rejectedFiles.push(`${file.name} is not a supported image`);
      } else if (file.size > MAX_FILE_SIZE) {
        rejectedFiles.push(`${file.name} is over 20 MB`);
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length === 0) {
      setError('Those files could not be used. Choose JPG, PNG, WEBP, or GIF images under 20 MB.');
      return;
    }

    if (rejectedFiles.length > 0) {
      setError(`Skipped ${rejectedFiles.length} file${rejectedFiles.length === 1 ? '' : 's'}: ${rejectedFiles.join(', ')}.`);
    }

    if (!append) {
      multiPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    }
    const existingPhotos = append ? multiPhotosRef.current : [];
    const nextPhotos: MultiPhoto[] = validFiles.map((file) => ({
      id: makePhotoId(),
      file,
      url: URL.createObjectURL(file),
      sourceImage: null,
      isLoading: true,
      zoom: 1,
      panX: 0,
      panY: 0,
      caption: '',
    }));

    setMultiPhotos([...existingPhotos, ...nextPhotos]);
    setActivePhotoId(nextPhotos[0].id);
    setIsMultiLoading(true);

    const loadPromises = nextPhotos.map((photo) => new Promise<void>((resolve) => {
      const nextImage = new window.Image();
      nextImage.onload = () => {
        setMultiPhotos((current) => current.map((item) => (
          item.id === photo.id
            ? { ...item, sourceImage: nextImage, isLoading: false }
            : item
        )));
        resolve();
      };
      nextImage.onerror = () => {
        setMultiPhotos((current) => current.map((item) => (
          item.id === photo.id ? { ...item, isLoading: false } : item
        )));
        setError((current) => current || `Could not read ${photo.file.name}. Please remove it and choose another image.`);
        resolve();
      };
      nextImage.src = photo.url;
    }));

    void Promise.all(loadPromises).then(() => setIsMultiLoading(false));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    validateAndLoad(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleMultipleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    validateAndLoadMultiple(Array.from(event.target.files ?? []), multiPhotosRef.current.length > 0);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    validateAndLoad(event.dataTransfer.files?.[0]);
  };

  const handleMultipleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    validateAndLoadMultiple(Array.from(event.dataTransfer.files), multiPhotosRef.current.length > 0);
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

  const resetMultiple = () => {
    multiPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    setMultiPhotos([]);
    setActivePhotoId(null);
    setIsMultiLoading(false);
    setMultiDownloaded(false);
    setIsDownloading(false);
    setError('');
  };

  const removePhoto = (photoId: string) => {
    const photoToRemove = multiPhotosRef.current.find((photo) => photo.id === photoId);
    if (!photoToRemove) return;

    URL.revokeObjectURL(photoToRemove.url);
    const remainingPhotos = multiPhotosRef.current.filter((photo) => photo.id !== photoId);
    setMultiPhotos(remainingPhotos);
    setMultiDownloaded(false);

    if (activePhotoId === photoId) {
      const nextActivePhoto = remainingPhotos[0] ?? null;
      setActivePhotoId(nextActivePhoto?.id ?? null);
    }
    setIsMultiLoading(remainingPhotos.some((photo) => photo.isLoading));
  };

  const updateActiveCaption = (nextCaption: string) => {
    if (appMode === 'single') {
      setCaption(nextCaption);
      setDownloaded(false);
      return;
    }

    if (!activePhotoId) return;
    setMultiPhotos((current) => current.map((photo) => (
      photo.id === activePhotoId
        ? { ...photo, caption: nextCaption }
        : photo
    )));
    setMultiDownloaded(false);
  };

  const updateZoom = (nextZoom: number) => {
    const clampedZoom = Math.min(3, Math.max(1, nextZoom));
    if (appMode === 'single') {
      setZoom(clampedZoom);
      setDownloaded(false);
      return;
    }

    if (!activePhotoId) return;
    setMultiPhotos((current) => current.map((photo) => (
      photo.id === activePhotoId ? { ...photo, zoom: clampedZoom } : photo
    )));
    setMultiDownloaded(false);
  };

  const updatePan = (nextPanX: number, nextPanY: number) => {
    if (appMode === 'single') {
      setPanX(nextPanX);
      setPanY(nextPanY);
      setDownloaded(false);
      return;
    }

    if (!activePhotoId) return;
    setMultiPhotos((current) => current.map((photo) => (
      photo.id === activePhotoId
        ? { ...photo, panX: nextPanX, panY: nextPanY }
        : photo
    )));
    setMultiDownloaded(false);
  };

  const handlePhotoPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!previewSourceImage || (event.target as HTMLElement).closest('button, input')) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: previewPanX,
      startPanY: previewPanY,
      width: bounds.width,
      height: bounds.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePhotoPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !previewSourceImage) return;

    const panLimits = getPanLimits(previewSourceImage, formatConfig, previewZoom);
    const displayedLimitX = panLimits.x * (drag.width / formatConfig.photoWidth);
    const displayedLimitY = panLimits.y * (drag.height / formatConfig.photoHeight);
    const deltaX = displayedLimitX ? ((event.clientX - drag.startX) / displayedLimitX) * 100 : 0;
    const deltaY = displayedLimitY ? ((event.clientY - drag.startY) / displayedLimitY) * 100 : 0;

    updatePan(
      Math.min(100, Math.max(-100, drag.startPanX + deltaX)),
      Math.min(100, Math.max(-100, drag.startPanY + deltaY)),
    );
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
      const blob = await renderPolaroidBlob(
        sourceImage,
        formatConfig,
        { zoom, panX, panY },
        displayCaption,
      );
      if (!blob) throw new Error('Could not make the image');

      triggerBlobDownload(blob, 'lavictoria-polaroid.png');
      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 2600);
    } catch {
      setError('We could not prepare that photo. Try choosing it again.');
    }
  };

  const downloadMultiple = async () => {
    if (!allMultiPhotosReady || isMultiLoading || isDownloading) return;
    const photosToDownload = multipleMode === 'repeat'
      ? (activePhoto ? Array.from({ length: repeatCount }, () => activePhoto) : [])
      : multiPhotos;
    if (photosToDownload.length === 0) return;

    setError('');
    setIsDownloading(true);

    try {
      for (const [index, photo] of photosToDownload.entries()) {
        if (!photo.sourceImage) throw new Error('Photo is unavailable');
        const blob = await renderPolaroidBlob(
          photo.sourceImage,
          formatConfig,
          photo,
          photo.caption.trim(),
        );
        if (!blob) throw new Error('Could not make the image');
        const baseName = photo.file.name
          .replace(/\.[^.]+$/, '')
          .replace(/[^a-z0-9]+/gi, '-')
          .replace(/^-|-$/g, '')
          .toLowerCase() || 'photo';
        triggerBlobDownload(blob, `lavictoria-${baseName}-${index + 1}.png`);
        await new Promise((resolve) => window.setTimeout(resolve, 70));
      }

      setMultiDownloaded(true);
      window.setTimeout(() => setMultiDownloaded(false), 3000);
    } catch {
      setError('We could not prepare the photo set. Try choosing the images again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const previewFile = appMode === 'single' ? image : activePhoto;
  const previewIsLoading = appMode === 'single'
    ? isLoading
    : isMultiLoading || Boolean(activePhoto?.isLoading);
  const outputCount = appMode === 'single'
    ? 1
    : multipleMode === 'repeat' ? repeatCount : multiPhotos.length;
  const mountPhotos: MountPhoto[] = appMode === 'single'
    ? (image ? [{
      id: 'single-photo',
      fileName: image.file.name,
      sourceImage,
      zoom,
      panX,
      panY,
      caption,
    }] : [])
    : (multipleMode === 'repeat'
      ? (activePhoto ? Array.from({ length: repeatCount }, (_, index) => ({
        id: `${activePhoto.id}-repeat-${index}`,
        fileName: activePhoto.file.name,
        sourceImage: activePhoto.sourceImage,
        zoom: activePhoto.zoom,
        panX: activePhoto.panX,
        panY: activePhoto.panY,
        caption: activePhoto.caption,
      })) : [])
      : multiPhotos.map((photo) => ({
        id: photo.id,
        fileName: photo.file.name,
        sourceImage: photo.sourceImage,
        zoom: photo.zoom,
        panX: photo.panX,
        panY: photo.panY,
        caption: photo.caption,
      })));

  return (
    <div className={`app-shell${appMode === 'multiple' ? ' is-multiple-mode' : ''}`}>
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
            {appMode === 'single'
              ? 'Turn one favorite photo into a classic Polaroid-style print, ready to save and keep close.'
              : 'Turn a handful of favorite photos into Polaroid-style prints, ready to save and keep close.'}
          </p>
        </section>

        <div className="workspace">
          <section className="control-column" aria-labelledby="upload-heading">
            <h2 className="section-label" id="upload-heading">
              {appMode === 'single' ? '01 / Choose a photo' : '01 / Choose your photos'}
            </h2>

            <div className="mode-field">
              <div className="mode-field-header">
                <span className="format-label">Create mode</span>
                <span className="format-hint">one print or a small set</span>
              </div>
              <div className="mode-options" role="radiogroup" aria-label="Create mode">
                <button
                  className={`mode-option${appMode === 'single' ? ' is-selected' : ''}`}
                  type="button"
                  role="radio"
                  aria-checked={appMode === 'single'}
                  onClick={() => switchMode('single')}
                  data-testid="button-mode-single"
                >
                  <ImageIcon size={16} />
                  <span>
                    <strong>Single photo</strong>
                    <small>one keepsake</small>
                  </span>
                </button>
                <button
                  className={`mode-option${appMode === 'multiple' ? ' is-selected' : ''}`}
                  type="button"
                  role="radio"
                  aria-checked={appMode === 'multiple'}
                  onClick={() => switchMode('multiple')}
                  data-testid="button-mode-multiple"
                >
                  <Images size={17} />
                  <span>
                    <strong>Multiple photos</strong>
                    <small>make a small batch</small>
                  </span>
                </button>
              </div>
            </div>

            {appMode === 'single' ? (
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
            ) : (
              <label
                className={`drop-zone multiple-drop-zone${isDragging ? ' is-dragging' : ''}`}
                htmlFor="multiple-photo-upload"
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleMultipleDrop}
                data-testid="dropzone-multiple-photos"
              >
                <input
                  ref={multipleFileInputRef}
                  id="multiple-photo-upload"
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES.join(',')}
                  onChange={handleMultipleFileChange}
                  data-testid="input-multiple-photo-upload"
                />
                <span className="upload-seal" aria-hidden="true">
                  <Images size={22} strokeWidth={1.8} />
                </span>
                <h3 className="drop-title">Bring a few moments in</h3>
                <p className="drop-caption">Drop several photos here, or choose a group from your camera roll.</p>
                <span className="browse-button" role="button" aria-label="Choose multiple photos from your device" data-testid="button-choose-multiple-photos">
                  <ImageIcon size={16} />
                  Browse photos
                </span>
                <p className="file-note"><FileImage size={13} /> JPG, PNG, WEBP, or GIF · up to 20 MB each</p>
              </label>
            )}

            {appMode === 'multiple' && multiPhotos.length > 0 && (
              <>
                <div className="photo-library">
                  <div className="photo-library-header">
                    <span className="format-label">Your photo set</span>
                    <div className="photo-library-actions">
                      <span className="photo-library-count" data-testid="text-photo-count">
                        {multiPhotos.length} photo{multiPhotos.length === 1 ? '' : 's'}
                      </span>
                      <button
                        className="add-photos-button"
                        type="button"
                        onClick={() => multipleFileInputRef.current?.click()}
                        data-testid="button-add-more-photos"
                      >
                        <Plus size={13} />
                        Add more
                      </button>
                    </div>
                  </div>
                  <div className="photo-grid" role="list" aria-label="Uploaded photos">
                    {multiPhotos.map((photo, index) => {
                      const isSelected = photo.id === activePhoto?.id;
                      return (
                        <div
                          key={photo.id}
                          role="listitem"
                          className={`photo-thumb${isSelected ? ' is-selected' : ''}`}
                          data-testid={`card-photo-${photo.id}`}
                        >
                          <button
                            className="photo-thumb-select"
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              setActivePhotoId(photo.id);
                              setMultiDownloaded(false);
                            }}
                            data-testid={`button-select-photo-${photo.id}`}
                          >
                            <span className="photo-thumb-image">
                              <img src={photo.url} alt={`Uploaded photo ${index + 1}: ${photo.file.name}`} />
                              {photo.isLoading && <span className="photo-thumb-loading" aria-label="Loading photo" />}
                            </span>
                            <span className="photo-thumb-meta">
                              <strong>{String(index + 1).padStart(2, '0')}</strong>
                              <small>{photo.file.name}</small>
                            </span>
                          </button>
                          <button
                            className="photo-thumb-remove"
                            type="button"
                            onClick={() => removePhoto(photo.id)}
                            aria-label={`Remove photo ${index + 1}`}
                            data-testid={`button-remove-photo-${photo.id}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="photo-library-hint">
                    Select a photo to adjust its framing in the preview.
                  </p>
                </div>

                <div className="multiple-mode-field">
                  <div className="format-field-header">
                    <span className="format-label">Batch output</span>
                    <span className="format-hint">choose how to make them</span>
                  </div>
                  <div className="multiple-mode-options" role="radiogroup" aria-label="Batch output mode">
                    <button
                      className={`multiple-mode-option${multipleMode === 'each' ? ' is-selected' : ''}`}
                      type="button"
                      role="radio"
                      aria-checked={multipleMode === 'each'}
                      onClick={() => {
                        setMultipleMode('each');
                        setMultiDownloaded(false);
                      }}
                      data-testid="button-batch-one-per-photo"
                    >
                      <span className="mode-radio-mark" aria-hidden="true" />
                      <span>
                        <strong>One Polaroid per photo</strong>
                        <small>Download one keepsake for each uploaded image.</small>
                      </span>
                    </button>
                    <button
                      className={`multiple-mode-option${multipleMode === 'repeat' ? ' is-selected' : ''}`}
                      type="button"
                      role="radio"
                      aria-checked={multipleMode === 'repeat'}
                      onClick={() => {
                        setMultipleMode('repeat');
                        setMultiDownloaded(false);
                      }}
                      data-testid="button-batch-repeat-photo"
                    >
                      <span className="mode-radio-mark" aria-hidden="true" />
                      <span>
                        <strong>Repeat one photo</strong>
                        <small>Use the selected thumbnail for an identical batch.</small>
                      </span>
                    </button>
                  </div>
                  {multipleMode === 'repeat' && (
                    <div className="repeat-settings">
                      <label htmlFor="repeat-count">Number of identical Polaroids</label>
                      <div className="repeat-count-control">
                        <button
                          className="zoom-button repeat-count-button"
                          type="button"
                          onClick={() => setRepeatCount((current) => Math.max(2, current - 1))}
                          aria-label="Decrease repeat count"
                          data-testid="button-repeat-count-decrease"
                        >
                          <Minus size={13} />
                        </button>
                        <input
                          id="repeat-count"
                          type="number"
                          min="2"
                          max="24"
                          value={repeatCount}
                          onChange={(event) => {
                            const nextCount = Number(event.target.value);
                            if (Number.isNaN(nextCount)) return;
                            setRepeatCount(Math.min(24, Math.max(2, nextCount)));
                            setMultiDownloaded(false);
                          }}
                          data-testid="input-repeat-count"
                        />
                        <button
                          className="zoom-button repeat-count-button"
                          type="button"
                          onClick={() => setRepeatCount((current) => Math.min(24, current + 1))}
                          aria-label="Increase repeat count"
                          data-testid="button-repeat-count-increase"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

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
                        setMultiDownloaded(false);
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
                <label className="caption-label" htmlFor={appMode === 'single' ? 'polaroid-caption' : 'multi-polaroid-caption'}>
                  {appMode === 'single' ? 'Add a caption' : `Caption for photo ${activePhoto ? String(multiPhotos.indexOf(activePhoto) + 1).padStart(2, '0') : '—'}`}
                </label>
                <span className="caption-hint">name, date, or a little note</span>
              </div>
              <div className="caption-input-wrap">
                <input
                  id={appMode === 'single' ? 'polaroid-caption' : 'multi-polaroid-caption'}
                  type="text"
                  value={appMode === 'single' ? caption : activePhoto?.caption ?? ''}
                  maxLength={MAX_CAPTION_LENGTH}
                  onChange={(event) => updateActiveCaption(event.target.value)}
                  placeholder="e.g. August 2026"
                  disabled={appMode === 'multiple' && !activePhoto}
                  data-testid={appMode === 'single' ? 'input-polaroid-caption' : 'input-multi-polaroid-caption'}
                />
                <span className="caption-count" aria-hidden="true">
                  {(appMode === 'single' ? caption : activePhoto?.caption ?? '').length}/{MAX_CAPTION_LENGTH}
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
              <h2 className="section-label" id="preview-heading">
                {appMode === 'single' ? '02 / Your keepsake' : '02 / Edit and review'}
              </h2>
              {hasPhotos && (
                <button
                  className="reset-button"
                  type="button"
                  onClick={appMode === 'single' ? resetImage : resetMultiple}
                  data-testid={appMode === 'single' ? 'button-reset-photo' : 'button-reset-photos'}
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
              aria-busy={previewIsLoading}
            >
              {previewFile ? (
                <div className="polaroid" style={frameStyle} data-testid="preview-polaroid">
                  <div
                    className={`polaroid-photo${previewSourceImage ? ' is-framable' : ''}`}
                    onPointerDown={handlePhotoPointerDown}
                    onPointerMove={handlePhotoPointerMove}
                    onPointerUp={finishPhotoDrag}
                    onPointerCancel={finishPhotoDrag}
                  >
                    <canvas
                      ref={canvasRef}
                      role="img"
                      aria-label={`Preview of ${previewFile.file.name}`}
                      data-testid="canvas-photo-preview"
                    />
                    {previewIsLoading && (
                      <div
                        className="loading-overlay"
                        data-testid="status-photo-loading"
                        role="status"
                        aria-label="Loading photo preview"
                      >
                        <div className="loading-spinner" />
                      </div>
                    )}
                    {previewSourceImage && (
                      <div
                        className="framing-controls"
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <span className="framing-hint">Drag to frame</span>
                        <div className="framing-slider-row">
                          <button
                            className="zoom-button"
                            type="button"
                            onClick={() => updateZoom(previewZoom - 0.1)}
                            aria-label="Zoom out"
                            data-testid="button-zoom-out"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="range"
                            min="1"
                            max="3"
                            step="0.01"
                            value={previewZoom}
                            onChange={(event) => updateZoom(Number(event.target.value))}
                            aria-label="Photo zoom"
                            data-testid="input-photo-zoom"
                          />
                          <button
                            className="zoom-button"
                            type="button"
                            onClick={() => updateZoom(previewZoom + 0.1)}
                            aria-label="Zoom in"
                            data-testid="button-zoom-in"
                          >
                            <Plus size={13} />
                          </button>
                          <span className="zoom-value">{Math.round(previewZoom * 100)}%</span>
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

            {appMode === 'multiple' && multiPhotos.length > 0 && (
              <div className="multi-preview" data-testid="multi-preview-grid">
                <div className="multi-preview-header">
                  <span className="format-label">03 / Check your set</span>
                  <span className="format-hint">select a card to edit</span>
                </div>
                <div className="multi-preview-grid">
                  {multiPhotos.map((photo, index) => (
                    <MiniPolaroidPreview
                      key={photo.id}
                      photo={photo}
                      formatConfig={formatConfig}
                      index={index}
                      isSelected={photo.id === activePhoto?.id}
                      onSelect={() => setActivePhotoId(photo.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              className={`download-button${(appMode === 'single' ? downloaded : multiDownloaded) ? ' is-done' : ''}`}
              type="button"
              disabled={appMode === 'single' ? !image || isLoading : !allMultiPhotosReady || isDownloading}
              onClick={appMode === 'single' ? downloadPolaroid : downloadMultiple}
              data-testid={appMode === 'single' ? 'button-download-polaroid' : 'button-download-polaroids'}
            >
              {(appMode === 'single' ? downloaded : multiDownloaded) ? <Check size={17} /> : <Download size={17} />}
              {appMode === 'single'
                ? (downloaded ? 'Saved to your downloads' : 'Download your Polaroid')
                : (multiDownloaded
                  ? 'Saved to your downloads'
                  : isDownloading ? 'Preparing your Polaroids…' : `Download ${outputCount} Polaroid${outputCount === 1 ? '' : 's'}`)}
            </button>
            <p className="shortcut" data-testid="text-download-hint">
              {appMode === 'single'
                ? (image ? `A PNG matching the ${formatConfig.label} frame you see above.` : 'Choose a photo to unlock the download.')
                : (multiPhotos.length > 0
                  ? 'Each PNG uses its photo’s saved framing, caption, and selected format.'
                  : 'Choose photos to unlock the download.')}
            </p>
          </section>
        </div>

        {mountPhotos.length > 0 && (
          <A4MountingStage items={mountPhotos} formatConfig={formatConfig} />
        )}

        <div className="footer-line" data-testid="text-footer">one photo · one keepsake · made locally</div>
      </main>
    </div>
  );
}

export default Home;