import {
  ArrowUpRight,
  Code2,
  Github,
  Globe,
  LockKeyhole,
  Monitor,
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookOpen } from '@fortawesome/free-solid-svg-icons';
import { accessCopy, accessLinks } from './access-content';
import './access-block.css';

/** Two light, unboxed columns before FAQ. No auth, token input or storage logic. */
export default function AccessBlock() {
  const desktop = accessCopy.desktop;
  const website = accessCopy.website;
  return (
    <section
      className="fg-access"
      id="figma-access"
      aria-label="Приложение и исходный код RSMine"
    >
      <article className="fg-access-column" aria-labelledby="fg-desktop-title">
        <div className="fg-access-icons" aria-hidden="true">
          <span>
            <Monitor size={21} />
          </span>
          <span className="fg-access-key">
            <LockKeyhole size={21} />
          </span>
          <span>
            <ArrowUpRight size={21} />
          </span>
        </div>
        <h2 id="fg-desktop-title">{desktop.title}</h2>
        <p>{desktop.description}</p>
        <a
          className="fg-access-button"
          href={accessLinks.desktopBuild}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FontAwesomeIcon icon={faBookOpen} style={{ marginRight: 6, fontSize: 14 }} />
          {desktop.button}
        </a>
        <a
          className="fg-access-secondary"
          href={accessLinks.desktop}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github size={16} aria-hidden="true" style={{ marginRight: 6 }} />
          {desktop.secondary}
        </a>
      </article>
      <article className="fg-access-column" aria-labelledby="fg-source-title">
        <div className="fg-access-icons" aria-hidden="true">
          <span>
            <Globe size={21} />
          </span>
          <span>
            <Code2 size={21} />
          </span>
          <span className="fg-access-github">
            <Github size={21} />
          </span>
        </div>
        <h2 id="fg-source-title">{website.title}</h2>
        <p>{website.description}</p>
        <a
          className="fg-access-button fg-access-button--github"
          href={accessLinks.website}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github size={16} aria-hidden="true" />
          {website.button}
        </a>
        <a
          className="fg-access-secondary"
          href={accessLinks.readme}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FontAwesomeIcon icon={faBookOpen} style={{ marginRight: 6, fontSize: 14 }} />
          {website.secondary}
        </a>
      </article>
    </section>
  );
}
