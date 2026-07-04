import { EventBus } from '../../core/EventBus';
import { StateStore } from '../../core/State';
import { Domain, Action } from '../../types/events';
import { Navbar3DLogo } from './Navbar3DLogo';

export class NavigationController {
  private eventBus: EventBus;
  private stateStore: StateStore<any>;
  private navbar: HTMLElement | null = null;
  private links: NodeListOf<HTMLButtonElement> | null = null;
  private logo3D: Navbar3DLogo | null = null;
  private navbarToggle: HTMLElement | null = null;
  private navbarMenu: HTMLElement | null = null;
  private unsubscribeState: (() => void) | null = null;

  // Section HUD Elements
  private sectionHud: HTMLElement | null = null;
  private sectionTitle: HTMLElement | null = null;
  private sectionDesc: HTMLElement | null = null;
  private sectionHint: HTMLElement | null = null;

  // Timeout to delay showing the HUD until camera has arrived (1.5 seconds)
  private navigationTimeout: any = null;

  // Section database containing atmospheric descriptions and interaction hints
  private sectionData: Record<string, { title: string; desc: string; hint: string; modalId?: string }> = {
    home: {
      title: 'SYSTEM: STABLE',
      desc: 'WELCOME TO THE IMMERSIVE PORTFOLIO',
      hint: 'Experience the world, Use the navigation bar above or Toggle MANUAL FLIGHT to pilot the drone yourself.'
    },
    projects: {
      title: 'PROJECTS',
      desc: 'EXPLORE ALL MY POPULAR PROJECTS',
      hint: 'Click the 3D models and learn more about them.',
      modalId: 'projects-space-explorer'
    },
    skills: {
      title: 'CORE SKILLS',
      desc: 'MY TECHNICAL & CREATIVE SKILLSET',
      hint: 'Tap the center console to enter GRID RUNNER arcade simulation. Hover and click orbiting capsules to decrypt sub-skill telemetry.',
      modalId: 'skills-core'
    },
    about: {
      title: 'ABOUT ME',
      desc: 'WHO I AM AND WHAT I DO',
      hint: 'Click the 3D Core to open the About Me modal and learn more about my background, experience, and interests.',
      modalId: 'about-core'
    },
    resume: {
      title: 'RESUMES AND EXPERIENCE',
      desc: 'VIEW MY PROFESSIONAL EXPERIENCE',
      hint: 'Click the 3D Resume Sphere to open the Resume modal and explore my experience, education, and achievements.',
      modalId: 'resume'
    }
  };

  constructor(eventBus: EventBus, stateStore: StateStore<any>) {
    this.eventBus = eventBus;
    this.stateStore = stateStore;
  }

  /**
   * Mounts the controller by binding to existing DOM elements or creating them.
   */
  public mount(): void {
    this.navbar = document.getElementById('navbar');
    if (!this.navbar) {
      console.warn('NavigationController: navbar element not found, waiting for DOM.');
      return;
    }

    // Initialize 3D Logo
    this.logo3D = new Navbar3DLogo('navbar-logo');
    this.logo3D.init();

    this.links = this.navbar.querySelectorAll('.navbar__link');
    this.navbarToggle = document.getElementById('navbar-toggle');
    this.navbarMenu = document.getElementById('navbar-menu');
    
    // Find Section HUD components
    this.sectionHud = document.getElementById('section-hud');
    this.sectionTitle = document.getElementById('section-hud-title');
    this.sectionDesc = document.getElementById('section-hud-desc');
    this.sectionHint = document.getElementById('section-hud-hint');

    this.setupListeners();
    this.subscribeToState();

    // Initialize HUD for current section
    const activeSection = this.stateStore.getState()?.navigation?.current || 'home';
    this.showSectionHud(activeSection);
  }

  /**
   * Sets up event listeners for the navbar buttons.
   */
  private setupListeners(): void {
    if (!this.links) return;

    this.links.forEach(link => {
      link.addEventListener('click', () => {
        const target = link.getAttribute('data-target');
        if (target) {
          this.navigate(target, true);
        }
      });
    });

    if (this.navbarToggle && this.navbarMenu) {
      this.navbarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navbarMenu?.classList.toggle('active');
        this.navbarToggle?.classList.toggle('active');
      });
    }

    // Close mobile menu when clicking outside
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (this.navbar && !this.navbar.contains(target)) {
        if (this.navbarMenu?.classList.contains('active')) {
          this.navbarMenu.classList.remove('active');
          this.navbarToggle?.classList.remove('active');
        }
      }
    });

    // Handle incoming events from the EventBus
    this.eventBus.on(`${Domain.NAV}:${Action.NAVIGATE}`, (payload: any) => {
      const target = typeof payload === 'string' ? payload : payload?.target;
      const isNavbarClick = typeof payload === 'string' ? false : !!payload?.isNavbarClick;
      if (target) {
        this.setNavItem(target);
        this.handleNavigationTransition(target, isNavbarClick);
      }
    });

    this.eventBus.on(`${Domain.NAV}:${Action.MENU_OPEN}`, () => {
      this.showNav();
    });

    this.eventBus.on(`${Domain.NAV}:${Action.MENU_CLOSE}`, () => {
      this.hideNav();
    });

    // Project Carousel active target sync
    this.eventBus.on('PROJECT_CAROUSEL:CHANGE', (payload: any) => {
      const { contentId } = payload;
      if (this.sectionData['projects']) {
        this.sectionData['projects'].modalId = contentId;
        if (contentId === 'projects-space-explorer') {
          this.sectionData['projects'].hint = 'SECURE CONNECTION ESTABLISHED. Hover and Click the 3D Space Explorer to open circuit telemetry.';
        } else if (contentId === 'projects-cyber-drone') {
          this.sectionData['projects'].hint = 'SECURE CONNECTION ESTABLISHED. Hover and Click the 3D AI Cyber-Drone to open agent telemetry.';
        } else if (contentId === 'projects-quantum-computing') {
          this.sectionData['projects'].hint = 'SECURE CONNECTION ESTABLISHED. Hover and Click the 3D Quantum Core to open circuit telemetry.';
        } else if (contentId === 'projects-bio-neural') {
          this.sectionData['projects'].hint = 'SECURE CONNECTION ESTABLISHED. Hover and Click the 3D Bio-Neural Node to open synapse telemetry.';
        }
        
        // Update Section HUD in real-time if currently viewing projects
        const currentState = this.stateStore.getState();
        const activeSection = currentState?.navigation?.current || 'home';
        if (activeSection === 'projects') {
          this.showSectionHud('projects');
        }
      }
    });

    // Camera Flight Mode Toggle
    const toggleBtn = document.getElementById('toggle-flight-mode');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        toggleBtn.blur();
        const currentState = this.stateStore.getState();
        // Cancel experience if active
        if (currentState.camera?.mode === 'EXPERIENCE') {
          this.eventBus.emit(`${Domain.CAMERA}:${Action.CHANGE}`, { mode: 'AUTO' });
        }

        const nextMode = (currentState.camera?.mode === 'MANUAL') ? 'AUTO' : 'MANUAL';
        
        // Dispatch action to update state
        this.stateStore.dispatch({
          type: 'CORE:STATE_CHANGE',
          payload: {
            camera: { mode: nextMode }
          }
        });

        // Emit on EventBus to notify CameraSystem
        this.eventBus.emit(`${Domain.CAMERA}:${Action.CHANGE}`, { mode: nextMode });

        // If transitioning back to AUTO, smoothly navigate back to active section's view
        if (nextMode === 'AUTO') {
          const activeSection = currentState.navigation?.current || 'home';
          this.navigate(activeSection);
        }
      });
    }

    // Go Home Button click handler
    const goHomeBtn = document.getElementById('go-home-btn');
    if (goHomeBtn) {
      goHomeBtn.addEventListener('click', () => {
        goHomeBtn.blur();
        this.navigate('home');
      });
    }

    // Mobile Projects Carousel Navigation click handlers
    const prevBtn = document.getElementById('project-prev-btn');
    const nextBtn = document.getElementById('project-next-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        prevBtn.blur();
        this.eventBus.emit('PROJECT_CAROUSEL:NAVIGATE', { direction: 'left' });
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        nextBtn.blur();
        this.eventBus.emit('PROJECT_CAROUSEL:NAVIGATE', { direction: 'right' });
      });
    }

    // Camera Experience Mode Toggle
    const toggleExperienceBtn = document.getElementById('toggle-experience-mode');
    if (toggleExperienceBtn) {
      toggleExperienceBtn.addEventListener('click', () => {
        toggleExperienceBtn.blur();
        const currentState = this.stateStore.getState();
        const isExperienceActive = currentState.camera?.mode === 'EXPERIENCE';
        const nextMode = isExperienceActive ? 'AUTO' : 'EXPERIENCE';

        // Dispatch action to update state
        this.stateStore.dispatch({
          type: 'CORE:STATE_CHANGE',
          payload: {
            camera: { mode: nextMode }
          }
        });

        // Emit on EventBus to notify CameraSystem
        this.eventBus.emit(`${Domain.CAMERA}:${Action.CHANGE}`, { mode: nextMode });

        if (nextMode === 'EXPERIENCE') {
          // Let CameraSystem handle smooth transition to the randomized spawn point
        } else {
          // Restore autopilot and return camera to currently active section's viewpoint
          const activeSection = currentState.navigation?.current || 'home';
          this.navigate(activeSection);
        }
      });
    }
  }

  /**
   * Subscribes to the global state store to synchronize navbar state with global state.
   */
  private subscribeToState(): void {
    this.unsubscribeState = this.stateStore.subscribe((state) => {
      if (state?.navigation?.current) {
        this.setNavItem(state.navigation.current);
      }

      // Handle Go Home button visibility on mobile
      const currentTab = state?.navigation?.current || 'home';
      const cameraMode = state?.camera?.mode || 'AUTO';
      const goHomeBtn = document.getElementById('go-home-btn');
      if (goHomeBtn) {
        if (currentTab !== 'home' && cameraMode !== 'EXPERIENCE') {
          goHomeBtn.classList.add('visible');
        } else {
          goHomeBtn.classList.remove('visible');
        }
      }

      // Handle Project Navigation Buttons visibility on mobile
      const projectNavMobile = document.getElementById('project-nav-mobile');
      if (projectNavMobile) {
        if (currentTab === 'projects' && cameraMode !== 'EXPERIENCE') {
          projectNavMobile.classList.add('visible');
        } else {
          projectNavMobile.classList.remove('visible');
        }
      }

      // Handle camera mode change rendering
      const toggleBtn = document.getElementById('toggle-flight-mode');
      if (toggleBtn && state?.camera?.mode) {
        if (state.camera.mode === 'MANUAL') {
          toggleBtn.classList.remove('active-autopilot');
          toggleBtn.classList.add('active-manual');
          const btnText = toggleBtn.querySelector('.btn-text');
          if (btnText) btnText.textContent = 'MANUAL FLIGHT';
        } else {
          toggleBtn.classList.remove('active-manual');
          toggleBtn.classList.add('active-autopilot');
          const btnText = toggleBtn.querySelector('.btn-text');
          if (btnText) btnText.textContent = 'AUTO-PILOT';
        }
      }

      // Handle experience mode change rendering
      const experienceBtn = document.getElementById('toggle-experience-mode');
      if (experienceBtn && state?.camera?.mode) {
        const btnText = experienceBtn.querySelector('.btn-text');
        if (state.camera.mode === 'EXPERIENCE') {
          experienceBtn.classList.add('active-experience');
          if (btnText) btnText.textContent = 'CANCEL EXPERIENCE';
        } else {
          experienceBtn.classList.remove('active-experience');
          if (btnText) btnText.textContent = 'EXPERIENCE WORLD';
        }
      }

      // Handle experience mode HUD adaptation
      const uiLayer = document.getElementById('ui-layer');
      if (uiLayer && state?.camera?.mode) {
        if (state.camera.mode === 'EXPERIENCE') {
          uiLayer.classList.add('experience-mode-active');
        } else {
          uiLayer.classList.remove('experience-mode-active');
        }
      }
    });
  }

  /**
   * Triggers navigation to a target section.
   */
  public navigate(target: string, isNavbarClick: boolean = false): void {
    // Close mobile menu on navigate
    if (this.navbarMenu?.classList.contains('active')) {
      this.navbarMenu.classList.remove('active');
      this.navbarToggle?.classList.remove('active');
    }

    // If we're currently in EXPERIENCE or MANUAL mode, switch to AUTO/auto-pilot!
    const currentState = this.stateStore.getState();
    const currentCameraMode = currentState?.camera?.mode;
    if (currentCameraMode === 'EXPERIENCE' || currentCameraMode === 'MANUAL') {
      this.stateStore.dispatch({
        type: 'CORE:STATE_CHANGE',
        payload: {
          camera: { mode: 'AUTO' }
        }
      });
      this.eventBus.emit(`${Domain.CAMERA}:${Action.CHANGE}`, { mode: 'AUTO' });
    }

    // Dispatch action to update state
    this.stateStore.dispatch({
      type: 'CORE:STATE_CHANGE',
      payload: {
        navigation: { current: target }
      }
    });

    // Emit event on EventBus (pass isNavbarClick to distinguish navbar vs entity clicks)
    this.eventBus.emit(`${Domain.NAV}:${Action.NAVIGATE}`, { target, isNavbarClick });

    // Play transition animation sequence
    this.eventBus.emit(`${Domain.ANIMATION}:${Action.TRIGGER}`, { sequenceName: 'transition' });
    
    // Play a tiny glitch feed jitter as an aesthetic accent
    this.eventBus.emit(`${Domain.ANIMATION}:${Action.TRIGGER}`, { sequenceName: 'glitch' });
  }

  /**
   * Sets the active navigation item visually.
   */
  public setNavItem(id: string): void {
    if (!this.links) return;

    this.links.forEach(link => {
      const target = link.getAttribute('data-target');
      if (target === id) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /**
   * Shows the navigation bar.
   */
  public showNav(): void {
    if (this.navbar) {
      this.navbar.classList.remove('navbar--hidden');
    }
  }

  /**
   * Hides the navigation bar.
   */
  public hideNav(): void {
    if (this.navbar) {
      this.navbar.classList.add('navbar--hidden');
    }
  }

  /**
   * Handles the section HUD transition during navigation.
   * Slides out the old HUD immediately, waits for flight duration, 
   * updates the content, slides in the new HUD, and auto-opens modals.
   */
  private handleNavigationTransition(target: string, isNavbarClick: boolean): void {
    // Hide panel immediately during camera flight
    if (this.sectionHud) {
      this.sectionHud.classList.add('hidden');
    }

    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }

    // Wait 1.5 seconds for the camera flight transition to complete
    this.navigationTimeout = setTimeout(() => {
      this.showSectionHud(target);

      // Auto-open main section modals when clicking navbar targets to minimize double-clicks
      if (isNavbarClick) {
        const data = this.sectionData[target];
        if (data && data.modalId) {
          this.eventBus.emit(`${Domain.MODAL}:${Action.OPEN}`, { contentId: data.modalId });
        }
      }
    }, 1500);
  }

  /**
   * Populates and reveals the Section HUD panel.
   */
  private showSectionHud(target: string): void {
    // Safety check: If Tetris is active, do not overwrite the specialized Tetris HUD!
    if (this.sectionHud && this.sectionHud.classList.contains('tetris-active-hud')) {
      return;
    }

    const data = this.sectionData[target];
    if (!data) return;

    if (this.sectionTitle) this.sectionTitle.textContent = data.title;
    if (this.sectionDesc) this.sectionDesc.textContent = data.desc;
    if (this.sectionHint) this.sectionHint.textContent = data.hint;

    if (this.sectionHud) {
      this.sectionHud.classList.remove('hidden');
      if (target === 'skills') {
        this.sectionHud.classList.add('skills-active-hud');
      } else {
        this.sectionHud.classList.remove('skills-active-hud');
      }
    }
  }

  /**
   * Destroys and cleans up listeners to prevent memory leaks.
   */
  public destroy(): void {
    if (this.logo3D) {
      this.logo3D.destroy();
      this.logo3D = null;
    }
    if (this.unsubscribeState) {
      this.unsubscribeState();
    }
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }
    this.navbar = null;
    this.links = null;
    this.navbarToggle = null;
    this.navbarMenu = null;
    this.sectionHud = null;
    this.sectionTitle = null;
    this.sectionDesc = null;
    this.sectionHint = null;
  }
}
