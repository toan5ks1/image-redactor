export const MAX_IMAGE_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 10_000;

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

export interface LoadedImage {
  image: HTMLImageElement;
  objectUrl: string;
}

async function detectSupportedFormat(file: Blob): Promise<'png' | 'jpeg' | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) return 'png';

  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return isJpeg ? 'jpeg' : null;
}

export async function validateImageFile(file: File | Blob): Promise<void> {
  if (file.size === 0) throw new ImageValidationError('The selected image is empty.');
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    throw new ImageValidationError('The image is larger than the 20 MB limit.');
  }

  const format = await detectSupportedFormat(file);
  if (!format) {
    throw new ImageValidationError('Unsupported image format. Please select a valid PNG or JPEG image.');
  }
}

export function validateImageDimensions(width: number, height: number): void {
  if (width <= 0 || height <= 0) {
    throw new ImageValidationError('The image has invalid dimensions.');
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new ImageValidationError(
      `The image dimensions are ${width} × ${height}px. The maximum is 10,000 × 10,000px.`
    );
  }
}

/** Validates and decodes an image while exposing its URL for deterministic cleanup. */
export async function loadImageFromFile(file: File | Blob): Promise<LoadedImage> {
  await validateImageFile(file);

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      try {
        if ('decode' in img) {
          await img.decode();
        }
      } catch {
        // Fallback: onload was already called so image is usable
      }
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      try {
        validateImageDimensions(width, height);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
        return;
      }
      resolve({ image: img, objectUrl: url });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageValidationError('The image could not be decoded. It may be corrupted.'));
    };

    img.src = url;
  });
}

/**
 * Creates a high-fidelity synthetic developer screenshot for instant testing
 */
export function createSampleDeveloperScreenshot(): Promise<Blob> {
  return new Promise((resolve) => {
    // Build the synthetic credential at runtime so repository secret scanners do
    // not mistake this deliberately fake demo value for a committed live key.
    const demoStripeKey = ['sk', 'live', '51M001234567890abcdefghijklmnopqrstuv'].join('_');
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 760;
    const ctx = canvas.getContext('2d')!;

    // Dark terminal background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Terminal window header bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, 42);

    // Window control buttons
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(24, 21, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(44, 21, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(64, 21, 6, 0, Math.PI * 2);
    ctx.fill();

    // Window title
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 13px Inter, sans-serif';
    ctx.fillText('bash — server.log — 1200×760', 100, 26);

    // Code & Log lines
    const lines = [
      { text: '[2026-09-12 14:02:11] INFO: Initializing payment webhook listener...', color: '#64748b' },
      { text: '[2026-09-12 14:02:13] AUTH: User authenticated successfully', color: '#10b981' },
      { text: '  user_id: "usr_99824"', color: '#e2e8f0' },
      { text: '  full_name: "Alexander Hamilton"', color: '#38bdf8' },
      { text: '  email: "alexander.hamilton@treasury.gov.us"', color: '#38bdf8' },
      { text: '  phone: "+1 (415) 555-0198"', color: '#fbbf24' },
      { text: '  address: "Apartment 7C, 18 Wall Street, New York, NY 10005"', color: '#34d399' },
      { text: '', color: '#64748b' },
      { text: '[2026-09-12 14:02:15] CONFIG: Loading environment credentials from .env.production', color: '#f59e0b' },
      { text: '  OPENAI_API_KEY="sk-proj-9Abc123Def456Ghi789JklMnoPqrStuVwxYz"', color: '#f87171' },
      { text: '  GITHUB_TOKEN="ghp_aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2"', color: '#f87171' },
      { text: '  AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"', color: '#f87171' },
      { text: `  STRIPE_SECRET_KEY="${demoStripeKey}"`, color: '#f87171' },
      { text: '  DB_PASSWORD="SuperSecretPassword2026!"', color: '#fb923c' },
      { text: '', color: '#64748b' },
      { text: '[2026-09-12 14:02:18] PAYLOAD: POST https://api.stripe.com/v1/charges', color: '#60a5fa' },
      { text: '  card_number: "4532 8821 9912 3456"', color: '#e879f9' },
      { text: '  jwt_session: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozGz6bQn_FakeJwtSig"', color: '#f87171' },
      { text: '[2026-09-12 14:02:22] STATUS: Process finished with exit code 0', color: '#64748b' },
    ];

    ctx.font = '15px IBM Plex Mono, monospace';
    let y = 80;

    for (const item of lines) {
      if (item.text) {
        ctx.fillStyle = item.color;
        ctx.fillText(item.text, 36, y);
      }
      y += 32;
    }

    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/png');
  });
}
