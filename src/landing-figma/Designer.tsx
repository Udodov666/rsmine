import { useEffect, useState } from 'react';
import { DesignTab } from '../app/routes/Settings';
import { DemoProvider } from '../landing/demo/DemoProvider';
import type { Config } from '../data/types';
import penguin from './assets/penguin.png';
import { READY_MEDIA } from '../data/defaults';
import { Reveal } from './Reveal';

/** Fresh Figma composition; controls reuse the actual app's design behavior, not an older landing. */
export default function Designer() {
  const [provider] = useState(() => {
    const p = new DemoProvider();
    const c = p.getConfig();
    const preset = c.presets.find((x) => x.id === c.activePresetId)!;
    Object.assign(preset, {
      mediaMode: 'tiers',
      mediaUrl: penguin,
      mediaTiers: [
        { minSum: 10, url: penguin },
        { minSum: 100, url: penguin },
        { minSum: 1000, url: penguin },
      ],
      titleTemplate: '{имя} - {сумма} RUB!',
      titleColor: '#F7941D',
      fontSize: 30,
      titleAlign: 'center',
      shadow: true,
      radius: 12,
      durationSec: 6,
      appear: 'fade',
      volume: 70,
      x: 564,
      y: 223,
      w: 696,
    });
    p.saveConfig(c);
    p.simulateTest();
    return p;
  });
  const [cfg, setCfg] = useState(() => provider.getConfig());
  useEffect(
    () => provider.subscribe(() => setCfg(provider.getConfig())),
    [provider],
  );
  function update(fn: (c: Config) => void) {
    const next = provider.getConfig();
    fn(next);
    provider.saveConfig(next);
  }
  return (
    <section id="figma-designer" className="fg-designer">
      <Reveal>
        <div className="fg-designer-heading">
          <span className="fg-kicker">КОНСТРУКТОР АЛЕРТОВ</span>
          <h2>
            настройте каждый
            <br />
            элемент алерта
          </h2>
          <p>Загрузите медиа, измените текст, шрифт и цвет.</p>
        </div>
      </Reveal>
      <Reveal delay={0.12} y={34}>
        <div className="fg-designer-ui fg-native">
        <DesignTab
          cfg={cfg}
          update={update}
          demoProvider={provider}
          mediaLibrary={READY_MEDIA}
        />
        </div>
      </Reveal>
    </section>
  );
}
