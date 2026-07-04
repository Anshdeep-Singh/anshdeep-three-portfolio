import { gsap } from 'gsap';
import { EventBus } from '../../core/EventBus';
import { Domain, Action } from '../../types/events';

export class ModalController {
  private eventBus: EventBus;
  private modalContainer: HTMLElement | null = null;
  private modalOverlay: HTMLElement | null = null;
  private modalWrapper: HTMLElement | null = null;
  private modalCloseBtn: HTMLElement | null = null;
  private modalContent: HTMLElement | null = null;
  private previouslyFocusedElement: HTMLElement | null = null;

  private activeIntervals: any[] = [];
  private activeAnimationFrames: any[] = [];
  private activeListeners: { element: any; type: string; listener: any }[] = [];

  // Static content database based on contentId
  private contents: Record<string, string> = {
    'resume': `
      <h2 class="text-h2">Curriculum Vitae 📄</h2>
      <p class="text-caption" style="margin-bottom: 16px; color: var(--color-primary);">MY EXPERIENCE AND EDUCATION</p>
      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px;">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <h3 style="font-size: 1.1rem; color: white; margin-bottom: 4px;">Quality Assurance Technician</h3>
            <p style="font-size: 0.85rem; color: var(--color-primary); margin-bottom: 8px;">2025 - Present | Walmart</p>
            <p class="text-body" style="font-size: 0.9rem;">Led DC KPI reporting, quality assurance, operational coordination, and Excel VBA automation, significantly improving reporting efficiency and operational accuracy.</p>
          </div>
          <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1);" />
          <div>
            <h3 style="font-size: 1.1rem; color: white; margin-bottom: 4px;">Technical Support | Student Assistant</h3>
            <p style="font-size: 0.85rem; color: var(--color-primary); margin-bottom: 8px;">2022 | Douglas College</p>
            <p class="text-body" style="font-size: 0.9rem;">Performed hardware quality assurance, technical troubleshooting, and documentation to maintain accurate lab operations.</p>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px;">
            <h4 style="color: white; font-size: 1rem; margin-bottom: 8px;">Education</h4>
            <p style="font-weight: 600; font-size: 0.9rem; color: var(--color-primary);">B.Tech in Electronics and Communication</p>
            <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 12px;">Symbiosis University (2017 - 2021)</p>
            <p style="font-weight: 600; font-size: 0.9rem; color: var(--color-primary);">PBD in Computing and Information Systems</p>
            <p style="font-size: 0.8rem; color: var(--color-text-muted);">Douglas College (2022 - 2024)</p>
          </div>
          <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px;">
            <h4 style="color: white; font-size: 1rem; margin-bottom: 8px;">Core Stack</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              <span style="font-size: 0.75rem; color: white; background: rgba(0,240,255,0.15); padding: 2px 6px; border-radius: 4px;">TypeScript</span>
              <span style="font-size: 0.75rem; color: white; background: rgba(0,240,255,0.15); padding: 2px 6px; border-radius: 4px;">Prompt Engineering</span>
              <span style="font-size: 0.75rem; color: white; background: rgba(0,240,255,0.15); padding: 2px 6px; border-radius: 4px;">3D Design</span>
              <span style="font-size: 0.75rem; color: white; background: rgba(0,240,255,0.15); padding: 2px 6px; border-radius: 4px;">Book Publishing</span>
              <span style="font-size: 0.75rem; color: white; background: rgba(0,240,255,0.15); padding: 2px 6px; border-radius: 4px;">AI Workflows</span>
            </div>
          </div>
        </div>
      </div>
    `,
    'about-core': `
      <h2 class="text-h2">About Me 💡</h2>
      <p class="text-caption" style="margin-bottom: 12px; color: var(--color-primary);">Blending Art, Design, and Advanced Computing</p>
      <p class="text-body" style="margin-bottom: 16px;">
        Hello! I'm <strong>Anshdeep Singh</strong>, I focus on building modern web applications, especially those that integrate AI and automation.
      </p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px;">
          <h3 style="color: white; font-size: 1rem; margin-bottom: 8px;">My Philosophy</h3>
          <p class="text-body" style="font-size: 0.85rem;">
          I design and manufacture functional products using 3D printing, turning ideas into tangible solutions. 
          </p>
        </div>
        <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px;">
          <h3 style="color: white; font-size: 1rem; margin-bottom: 8px;">What I Focus On</h3>
          <p class="text-body" style="font-size: 0.85rem;">
          From concept to prototype to market, I enjoy building systems - whether digital or physical - that solve real problems.
          </p>
        </div>
      </div>
      <p class="text-body">
      I’ve also self-published books through Amazon using custom-built automation tools, combining programming, design, and product thinking to create scalable digital assets.
      </p>
    `,
    'skills-core': `
      <h2 class="text-h2">Core Skills Overview 🌟</h2>
      <p class="text-caption" style="margin-bottom: 12px; color: var(--color-primary);">My Interdisciplinary Toolkit</p>
      <p class="text-body" style="margin-bottom: 16px;">
        My expertise bridges multiple domains, combining aesthetic design with robust engineering. Click on any of the orbiting nodes to explore specific skill areas.
      </p>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px;">
          <h3 style="color: white; font-size: 1.1rem; margin-bottom: 8px;">Product Development</h3>
          <p class="text-body" style="font-size: 0.9rem;">From concept to deployment, building scalable and user-centric applications.</p>
        </div>
        <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px;">
          <h3 style="color: white; font-size: 1.1rem; margin-bottom: 8px;">3D Design</h3>
          <p class="text-body" style="font-size: 0.9rem;">Creating immersive experiences using modern WebGL and 3D rendering engines.</p>
        </div>
        <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px;">
          <h3 style="color: white; font-size: 1.1rem; margin-bottom: 8px;">Web Design</h3>
          <p class="text-body" style="font-size: 0.9rem;">Crafting intuitive, responsive, and beautiful user interfaces.</p>
        </div>
      </div>
    `,
    'skills-productdevelopement': `
      <h2 class="text-h2">Product Development 🚀</h2>
      <p class="text-caption" style="margin-bottom: 12px; color: #00ffcc;">End-to-End Application Lifecycle</p>
      <p class="text-body" style="margin-bottom: 16px;">
        I specialize in turning ideas into tangible digital products. This involves deep collaboration, rigorous planning, and agile execution.
      </p>
      <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px; margin-bottom: 16px;">
        <h4 style="color: white; font-size: 0.95rem; margin-bottom: 8px;">Proficiency Levels</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>Agile Methodologies</span><span>95%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="95%" style="width: 0%; height: 100%; background: #00ffcc; border-radius: 3px;"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>System Architecture</span><span>88%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="88%" style="width: 0%; height: 100%; background: #00ffcc; border-radius: 3px;"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>CI/CD & DevOps</span><span>80%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="80%" style="width: 0%; height: 100%; background: #00ffcc; border-radius: 3px;"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px; margin-bottom: 16px;">
        <h4 style="color: white; margin-bottom: 6px;">Key Tools & Frameworks</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #00ffcc; border: 1px solid rgba(0,255,204,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(0,255,204,0.05);">Node.js</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #00ffcc; border: 1px solid rgba(0,255,204,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(0,255,204,0.05);">Docker</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #00ffcc; border: 1px solid rgba(0,255,204,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(0,255,204,0.05);">Git</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #00ffcc; border: 1px solid rgba(0,255,204,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(0,255,204,0.05);">Jira</span>
        </div>
      </div>
    `,
    'skills-3ddesign': `
      <h2 class="text-h2">3D Design & Rendering 🧊</h2>
      <p class="text-caption" style="margin-bottom: 12px; color: #ffcc00;">Immersive Web Experiences</p>
      <p class="text-body" style="margin-bottom: 16px;">
        I bring the web to life with high-performance 3D graphics, leveraging modern browser capabilities to build interactive, spatial environments.
      </p>
      <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px; margin-bottom: 16px;">
        <h4 style="color: white; font-size: 0.95rem; margin-bottom: 8px;">Proficiency Levels</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>Three.js / WebGL</span><span>92%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="92%" style="width: 0%; height: 100%; background: #ffcc00; border-radius: 3px;"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>Blender Modeling</span><span>85%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="85%" style="width: 0%; height: 100%; background: #ffcc00; border-radius: 3px;"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>GLSL Shaders</span><span>75%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="75%" style="width: 0%; height: 100%; background: #ffcc00; border-radius: 3px;"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px; margin-bottom: 16px;">
        <h4 style="color: white; margin-bottom: 6px;">Key Tools & Frameworks</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #ffcc00; border: 1px solid rgba(255,204,0,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(255,204,0,0.05);">Three.js</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #ffcc00; border: 1px solid rgba(255,204,0,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(255,204,0,0.05);">Blender</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #ffcc00; border: 1px solid rgba(255,204,0,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(255,204,0,0.05);">WebGL</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #ffcc00; border: 1px solid rgba(255,204,0,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(255,204,0,0.05);">R3F</span>
        </div>
      </div>
    `,
    'skills-webdesign': `
      <h2 class="text-h2">Web Design 🎨</h2>
      <p class="text-caption" style="margin-bottom: 12px; color: #ff3366;">Aesthetic & Functional UI/UX</p>
      <p class="text-body" style="margin-bottom: 16px;">
        Designing interfaces that are not only visually stunning but also highly usable. I focus on typography, color theory, and responsive layouts.
      </p>
      <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px; margin-bottom: 16px;">
        <h4 style="color: white; font-size: 0.95rem; margin-bottom: 8px;">Proficiency Levels</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>Figma & Prototyping</span><span>95%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="95%" style="width: 0%; height: 100%; background: #ff3366; border-radius: 3px;"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>CSS / Tailwind</span><span>98%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="98%" style="width: 0%; height: 100%; background: #ff3366; border-radius: 3px;"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>Interaction Animation</span><span>90%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="90%" style="width: 0%; height: 100%; background: #ff3366; border-radius: 3px;"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px; margin-bottom: 16px;">
        <h4 style="color: white; margin-bottom: 6px;">Key Tools & Frameworks</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #ff3366; border: 1px solid rgba(255,51,102,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(255,51,102,0.05);">Figma</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #ff3366; border: 1px solid rgba(255,51,102,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(255,51,102,0.05);">CSS/SCSS</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #ff3366; border: 1px solid rgba(255,51,102,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(255,51,102,0.05);">Tailwind</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #ff3366; border: 1px solid rgba(255,51,102,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(255,51,102,0.05);">GSAP</span>
        </div>
      </div>
    `,
    'skills-frontendarchitecture': `
      <h2 class="text-h2">Frontend Architecture ⚛️</h2>
      <p class="text-caption" style="margin-bottom: 12px; color: #3399ff;">Robust SPA Development</p>
      <p class="text-body" style="margin-bottom: 16px;">
        Building maintainable, high-performance web applications using modern component-based frameworks and state management patterns.
      </p>
      <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px; margin-bottom: 16px;">
        <h4 style="color: white; font-size: 0.95rem; margin-bottom: 8px;">Proficiency Levels</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>React / Next.js</span><span>95%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="95%" style="width: 0%; height: 100%; background: #3399ff; border-radius: 3px;"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>TypeScript</span><span>92%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="92%" style="width: 0%; height: 100%; background: #3399ff; border-radius: 3px;"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>State Management</span><span>88%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="88%" style="width: 0%; height: 100%; background: #3399ff; border-radius: 3px;"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px; margin-bottom: 16px;">
        <h4 style="color: white; margin-bottom: 6px;">Key Tools & Frameworks</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #3399ff; border: 1px solid rgba(51,153,255,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(51,153,255,0.05);">React</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #3399ff; border: 1px solid rgba(51,153,255,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(51,153,255,0.05);">Next.js</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #3399ff; border: 1px solid rgba(51,153,255,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(51,153,255,0.05);">TypeScript</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #3399ff; border: 1px solid rgba(51,153,255,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(51,153,255,0.05);">Redux</span>
        </div>
      </div>
    `,
    'skills-creativetechnologies': `
      <h2 class="text-h2">Creative Technologies 🔮</h2>
      <p class="text-caption" style="margin-bottom: 12px; color: #9933ff;">Interactive Prototypes & Experiments</p>
      <p class="text-body" style="margin-bottom: 16px;">
        Exploring the edge of web capabilities through generative art, physics simulations, and audio-reactive visuals.
      </p>
      <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px; margin-bottom: 16px;">
        <h4 style="color: white; font-size: 0.95rem; margin-bottom: 8px;">Proficiency Levels</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>Generative Art</span><span>85%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="85%" style="width: 0%; height: 100%; background: #9933ff; border-radius: 3px;"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>Physics Simulations</span><span>75%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="75%" style="width: 0%; height: 100%; background: #9933ff; border-radius: 3px;"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: white; margin-bottom: 4px;">
              <span>Audio Analysis</span><span>70%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div class="skill-progress-fill" data-level="70%" style="width: 0%; height: 100%; background: #9933ff; border-radius: 3px;"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="glass" style="padding: var(--spacing-sm); border-radius: 8px; margin-bottom: 16px;">
        <h4 style="color: white; margin-bottom: 6px;">Key Tools & Frameworks</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #9933ff; border: 1px solid rgba(153,51,255,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(153,51,255,0.05);">Web Audio API</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #9933ff; border: 1px solid rgba(153,51,255,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(153,51,255,0.05);">Canvas API</span>
          <span class="tech-chip" style="opacity: 0; transform: scale(0.8); font-size: 0.8rem; color: #9933ff; border: 1px solid rgba(153,51,255,0.3); padding: 4px 10px; border-radius: 12px; background: rgba(153,51,255,0.05);">Matter.js</span>
        </div>
      </div>
    `
  };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Mounts the modal controller by finding relevant DOM elements.
   */
  public mount(): void {
    this.modalContainer = document.getElementById('modal-container');
    if (!this.modalContainer) {
      console.warn('ModalController: modal-container element not found.');
      return;
    }

    this.modalOverlay = this.modalContainer.querySelector('.modal-container__overlay');
    this.modalWrapper = this.modalContainer.querySelector('.modal-container__wrapper');
    this.modalCloseBtn = this.modalContainer.querySelector('.modal-container__close');
    this.modalContent = this.modalContainer.querySelector('.modal-container__content');

    this.setupListeners();
  }

  /**
   * Sets up listeners for click, close, ESC, and custom EventBus triggers.
   */
  private setupListeners(): void {
    if (this.modalCloseBtn) {
      this.modalCloseBtn.addEventListener('click', () => this.close());
    }

    if (this.modalOverlay) {
      this.modalOverlay.addEventListener('click', () => this.close());
    }

    // Handle ESC key press
    window.addEventListener('keydown', this.handleKeyDown);

    // Subscribe to EventBus triggers
    this.eventBus.on(`${Domain.MODAL}:${Action.OPEN}`, (payload: any) => {
      const contentId = typeof payload === 'string' ? payload : payload?.contentId;
      if (contentId) {
        this.open(contentId);
      }
    });

    this.eventBus.on(`${Domain.MODAL}:${Action.CLOSE}`, () => {
      this.close();
    });
  }

  /**
   * Keyboard handler for accessibility features.
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.modalContainer && !this.modalContainer.classList.contains('hidden')) {
      if (event.key === 'Escape') {
        this.close();
      } else if (event.key === 'Tab') {
        this.trapFocus(event);
      }
    }
  };

  /**
   * Keeps keyboard navigation trapped inside the modal when active.
   */
  private trapFocus(event: KeyboardEvent): void {
    if (!this.modalContainer) return;

    // Get all focusable elements inside modal
    const focusableElements = this.modalContainer.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab (Backward)
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      // Tab (Forward)
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }

  /**
   * Opens the modal and renders the requested content.
   */
  public open(contentId: string): void {
    if (!this.modalContainer || !this.modalContent || !this.modalWrapper) return;

    // Save current active element to restore focus when closed
    this.previouslyFocusedElement = document.activeElement as HTMLElement;

    // Fetch and populate content
    const contentHtml = this.getDynamicContent(contentId);

    this.modalContent.innerHTML = contentHtml;

    // Clean up any previously active demo loops/listeners before mounting new ones
    this.cleanupActiveDemos();
    // Initialize interactive micro-demos if applicable
    this.initMicroDemo(contentId);

    // Reveal modal container in DOM
    this.modalContainer.classList.remove('hidden');
    this.modalContainer.setAttribute('aria-hidden', 'false');

    // Smooth GSAP reveal sequence
    gsap.killTweensOf([this.modalContainer, this.modalWrapper]);
    
    // Set starting values
    gsap.set(this.modalContainer, { opacity: 0 });
    gsap.set(this.modalWrapper, { scale: 0.9, y: 20 });

    gsap.to(this.modalContainer, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out'
    });

    gsap.to(this.modalWrapper, {
      scale: 1,
      y: 0,
      duration: 0.5,
      ease: 'back.out(1.2)',
      delay: 0.05,
      onComplete: () => {
        // Focus close button or first action element
        if (this.modalCloseBtn) {
          this.modalCloseBtn.focus();
        }
        this.animateSkillsContent();
      }
    });
  }

  /**
   * Triggers highly visual entry animations for elements inside the modal.
   */
  private animateSkillsContent(): void {
    const progressFills = this.modalContainer?.querySelectorAll('.skill-progress-fill');
    if (progressFills && progressFills.length > 0) {
      progressFills.forEach(fill => {
        const targetLevel = fill.getAttribute('data-level') || '0%';
        gsap.to(fill, {
          width: targetLevel,
          duration: 1.2,
          ease: 'power3.out'
        });
      });
    }

    const techChips = this.modalContainer?.querySelectorAll('.tech-chip');
    if (techChips && techChips.length > 0) {
      gsap.to(techChips, {
        opacity: 1,
        scale: 1,
        duration: 0.6,
        stagger: 0.06,
        ease: 'back.out(1.5)'
      });
    }
  }

  /**
   * Closes the modal.
   */
  public close(): void {
    if (!this.modalContainer || !this.modalWrapper) return;
    if (this.modalContainer.classList.contains('hidden')) return;

    // GSAP hide transition
    gsap.killTweensOf([this.modalContainer, this.modalWrapper]);

    gsap.to(this.modalWrapper, {
      scale: 0.9,
      y: 15,
      duration: 0.3,
      ease: 'power2.in'
    });

    gsap.to(this.modalContainer, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.inOut',
      onComplete: () => {
        this.modalContainer!.classList.add('hidden');
        this.modalContainer!.setAttribute('aria-hidden', 'true');
        
        // Clean up active demo loops/listeners to prevent leaks
        this.cleanupActiveDemos();

        // Restore focus to previous element for screen readers/A11y
        if (this.previouslyFocusedElement) {
          this.previouslyFocusedElement.focus();
        }

        // Notify other components
        this.eventBus.emit(`${Domain.MODAL}:${Action.CLOSE}`, {});
      }
    });
  }

  /**
   * Clean up active interactive micro-demos.
   */
  private cleanupActiveDemos(): void {
    // Clean up active animation frames
    this.activeAnimationFrames.forEach(frameId => cancelAnimationFrame(frameId));
    this.activeAnimationFrames = [];

    // Clean up active intervals & timeouts
    this.activeIntervals.forEach(intervalId => {
      clearInterval(intervalId);
      clearTimeout(intervalId);
    });
    this.activeIntervals = [];

    // Clean up active DOM listeners
    this.activeListeners.forEach(({ element, type, listener }) => {
      if (element) {
        element.removeEventListener(type, listener);
      }
    });
    this.activeListeners = [];
  }

  /**
   * Mounts the Javascript / TypeScript engine for each corresponding micro-demo.
   */
  private initMicroDemo(_contentId: string): void {
    // Left empty since we refactored skills to use simple GSAP animations for progress bars and chips.
  }

  /**
   * Retrieves content dynamically.
   */
  public getDynamicContent(contentId: string): string {
    if (contentId.startsWith('projects-dynamic-')) {
      const index = parseInt(contentId.split('-').pop() || '0', 10);
      const saved = localStorage.getItem('project-list-data');
      if (saved) {
        try {
          const projects = JSON.parse(saved);
          const p = projects[index];
          if (p) {
            return `
              <h2 class="text-h2">Project: ${p.title}</h2>
              <p class="text-caption" style="margin-bottom: 12px; color: var(--color-primary);">Template: ${p.symbol}</p>
              <div style="display: grid; grid-template-columns: 1fr; gap: 16px; margin-bottom: 16px;">
                <div class="glass" style="padding: var(--spacing-xs); border-radius: 8px;">
                  <h4 style="color: white; font-size: 0.9rem; margin-bottom: 4px;">Details</h4>
                  <p class="text-body" style="font-size: 0.85rem; padding-left: 12px;">${p.details}</p>
                </div>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
                <span class="glass" style="padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; color: var(--color-primary);">${p.stack}</span>
              </div>
              ${p.pdfUrl ? `<button class="glass interactive-btn" onclick="window.open('${p.pdfUrl}', '_blank')" style="padding: var(--spacing-xs) var(--spacing-sm); border-radius: 4px; cursor: pointer; color: white; font-weight: 600;">View Details</button>` : ''}
            `;
          }
        } catch(e) {}
      }
      return this.getFallbackHtml(contentId);
    }

    return this.contents[contentId] || this.contents[contentId.replace('skills-', 'skills-').replace(' ', '').toLowerCase()] || this.getFallbackHtml(contentId);
  }

  private getFallbackHtml(contentId: string): string {
    return `
      <h2 class="text-h2">Details</h2>
      <p class="text-body">Information for category "${contentId}" is currently being loaded or is unavailable.</p>
    `;
  }

  /**
   * Clean up listener dependencies to prevent leaks.
   */
  public destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.cleanupActiveDemos();
    this.modalContainer = null;
    this.modalOverlay = null;
    this.modalWrapper = null;
    this.modalCloseBtn = null;
    this.modalContent = null;
  }
}
