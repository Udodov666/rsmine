import { useEffect, useState } from 'react';
import { getProvider } from '../../data/providerSwitch';
import QRCode from 'qrcode';
import { ExternalLink } from 'lucide-react';
import { getMockProvider } from '../../data/mock/MockProvider';
import { Button } from '../../components/Button';
import { CopyButton } from '../../components/Bits';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';

const RESERVED = ['api', 'overlay', 'donate', 'app', 'd', 'static'];

/** Страница донатов: публичная ссылка с QR и адрес страницы. */
export default function LinkPage() {
  const toast = useToast();
  const provider = getProvider();
  const [, force] = useState(0);
  const cfg = provider.getConfig();
  const [slug, setSlug] = useState(cfg.slug);
  const [qr, setQr] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => provider.subscribe(() => force((v) => v + 1)), [provider]);

  const origin = window.location.origin;
  const publicUrl = `${origin}/#/d/${slug}`;
  const error = validateSlug(slug);
  const changed = slug !== cfg.slug;

  useEffect(() => {
    QRCode.toDataURL(publicUrl, { margin: 1, width: 180, color: { dark: '#f5f5f5', light: '#171717' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [publicUrl]);

  return (
    <div className="settings-wrap">
      <h1 className="page-h1">Страница донатов</h1>
      <div className="page-sub">Публичная страница приёма донатов: ссылка, адрес и QR-код.</div>

      <section className="gcard">
        <div className="glink-top">
          <div className="glink-main">
            <div className="pg-title">Публичная ссылка</div>
            <div className="pg-desc">Эту ссылку и QR вы публикуете там, где зрители отправляют донаты.</div>
            <div className="glink-row">
              <span className="ginput-copy">
                <input className="st-input" readOnly value={publicUrl} onFocus={(e) => e.target.select()} />
                <span className="ginput-copy-btn">
                  <CopyButton text={publicUrl} onCopied={() => toast('Ссылка скопирована')} />
                </span>
              </span>
              <Button variant="outline" onClick={() => window.open(publicUrl, '_blank')}>
                <ExternalLink size={13} strokeWidth={1.8} /> Открыть
              </Button>
            </div>
          </div>
          <div className="gqr-box">
            {qr && <img src={qr} alt="QR публичной ссылки" width={110} height={110} style={{ borderRadius: 10 }} />}
          </div>
        </div>
      </section>

      <section className="gcard gmt">
        <div className="pg-title">Адрес страницы</div>
        <div className="pg-desc">
          Короткий адрес внутри ссылки. Если смените его — старые ссылки и QR перестанут
          работать, а освободившийся адрес не достанется никому другому.
        </div>
        <div className="gfield">
          <span className="glabel">Адрес</span>
          <span className="gslug">
            <input
              className={`st-input ${error ? 'error' : ''}`}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
            />
            <Button variant="primary" disabled={!!error || !changed} onClick={() => setConfirmOpen(true)}>
              Сохранить
            </Button>
          </span>
        </div>
        {error && <div className="field-error" style={{ marginTop: 8 }}>{error}</div>}
      </section>

      {confirmOpen && (
        <Modal
          title="Изменить адрес страницы?"
          critical
          onClose={() => setConfirmOpen(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Отмена</Button>
              <Button
                variant="danger"
                loading={saving}
                loadingText="Сохраняем"
                onClick={async () => {
                  setSaving(true);
                  await new Promise((resolve) => window.setTimeout(resolve, 520));
                  const next = provider.getConfig();
                  next.slug = slug;
                  provider.saveConfig(next);
                  setSaving(false);
                  setConfirmOpen(false);
                  toast('Адрес сохранён. Старые ссылки перестанут работать.');
                }}
              >
                Изменить
              </Button>
            </>
          }
        >
          Публичная страница переедет на новый адрес. Старые ссылки и QR перестанут работать.
        </Modal>
      )}
    </div>
  );
}

function validateSlug(s: string): string | null {
  if (s.length < 3) return 'Минимум 3 символа';
  if (s.length > 32) return 'Максимум 32 символа';
  if (!/^[a-z0-9-]+$/.test(s)) return 'Только латиница, цифры и дефис';
  if (RESERVED.includes(s)) return 'Адрес зарезервирован системой';
  return null;
}
