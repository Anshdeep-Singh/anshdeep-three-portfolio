import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { gsap } from 'gsap';
import { Domain, Action, AppEventName } from '../../types/events';

interface ResumeData {
  symbol: string;
  title: string;
  number: string;
  details: string;
  stack: string;
  pdfUrl?: string;
}

export class ResumeActor extends BaseActor {
  private tiles: CSS3DObject[] = [];
  private cssSceneRef?: THREE.Scene;
  private backButton!: HTMLButtonElement;
  private eventBus: any;

  // Active state: 'sphere' or 'table'
  private viewMode: 'sphere' | 'table' = 'sphere';
  private isActive: boolean = false;
  private autoRotationY: number = 0;

  // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE:
  // Note: Keep it as an empty string ('') if you want to use the local browser cache fallback.
  private appsScriptUrl: string = 'https://script.google.com/macros/s/AKfycbxzEo5n56qqww3_i--Rt6_t55BpoHtPz2Iq0t5Bqs1UJxw62iU-hlZKWblQhzBTfqTa/exec';

  // Resume Dataset
  private resumeList: ResumeData[] = [];

  private defaultResumeList: ResumeData[] = [
    {
      symbol: 'CT',
      title: 'Creative Tech',
      number: '01',
      details: 'Creative Technologist',
      stack: 'WebGL / Three.js / GLSL',
      pdfUrl: 'https://drive.google.com/file/d/1XgG9Vz7C2X4f-lU5PzR_defaultCT/view?usp=sharing'
    },
    {
      symbol: 'FE',
      title: 'UI Architect',
      number: '02',
      details: 'Frontend Architect',
      stack: 'React / TS / Next.js',
      pdfUrl: 'https://drive.google.com/file/d/1XgG9Vz7C2X4f-lU5PzR_defaultFE/view?usp=sharing'
    },
    {
      symbol: 'FS',
      title: 'Full-Stack',
      number: '03',
      details: 'Systems Engineer',
      stack: 'Node / Postgres / Docker',
      pdfUrl: 'https://drive.google.com/file/d/1XgG9Vz7C2X4f-lU5PzR_defaultFS/view?usp=sharing'
    },
    {
      symbol: 'AI',
      title: 'AI Integrator',
      number: '04',
      details: 'AI Heuristics Dev',
      stack: 'Python / TF.js / LLMs',
      pdfUrl: 'https://drive.google.com/file/d/1XgG9Vz7C2X4f-lU5PzR_defaultAI/view?usp=sharing'
    },
    {
      symbol: 'XR',
      title: 'XR Developer',
      number: '05',
      details: 'Immersive Dev',
      stack: 'WebXR / Shaders / Math',
      pdfUrl: 'https://drive.google.com/file/d/1XgG9Vz7C2X4f-lU5PzR_defaultXR/view?usp=sharing'
    }
  ];

  constructor() {
    super('resume-showcase');
    this.loadResumeList();
  }

  private async loadResumeList(): Promise<void> {
    // 1. Initial load from local storage or defaults for immediate response
    const saved = localStorage.getItem('resume-list-data');
    if (saved) {
      try {
        this.resumeList = JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved resume list:', e);
        this.resumeList = [...this.defaultResumeList];
      }
    } else {
      this.resumeList = [...this.defaultResumeList];
    }

    // 2. Fetch fresh data from Google Sheet if URL is provided
    if (this.appsScriptUrl) {
      try {
        const fetchUrl = this.appsScriptUrl.includes('?') ? `${this.appsScriptUrl}&sheet=Resume` : `${this.appsScriptUrl}?sheet=Resume`;
        const response = await fetch(fetchUrl);
        if (response.ok) {
          const remoteData = await response.json();
          if (Array.isArray(remoteData) && remoteData.length > 0) {
            this.resumeList = remoteData;
            localStorage.setItem('resume-list-data', JSON.stringify(this.resumeList));
            // Trigger 3D view rebuild with live data
            this.rebuildTiles();
          }
        }
      } catch (e) {
        console.error('Failed to fetch from Google Sheets, using local storage fallback:', e);
      }
    }
  }

  private saveResumeList(): void {
    localStorage.setItem('resume-list-data', JSON.stringify(this.resumeList));

    if (this.appsScriptUrl) {
      const postUrl = this.appsScriptUrl.includes('?') ? `${this.appsScriptUrl}&sheet=Resume` : `${this.appsScriptUrl}?sheet=Resume`;
      fetch(postUrl, {
        method: 'POST',
        mode: 'no-cors', // standard mode for Google Apps Script Web App post targets to bypass CORS preflights
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(this.resumeList)
      })
      .then(() => {
        console.log('Saved to Google Sheets (Google Apps Script) successfully!');
      })
      .catch((e) => {
        console.error('Failed to save to Google Sheets:', e);
      });
    }
  }

  public setup(): void {
    // 1. Core visual placeholder in WebGL (central hub)
    const hubGeo = new THREE.IcosahedronGeometry(0.8, 1);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.4,
      wireframe: true
    });
    const centralHub = new THREE.Mesh(hubGeo, hubMat);
    centralHub.name = 'Resume Hub';
    this.mesh.add(centralHub);

    // Dynamic particles inside the hub
    const particlesGeo = new THREE.BufferGeometry();
    const count = 30;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 1.5;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMat = new THREE.PointsMaterial({
      color: 0x00ff88,
      size: 0.05,
      transparent: true,
      opacity: 0.8
    });
    const points = new THREE.Points(particlesGeo, particlesMat);
    this.mesh.add(points);

    // Retrieve global EventBus & Engine references
    const app = (window as any).app;
    if (!app) return;
    this.eventBus = app.eventBus;
    this.cssSceneRef = app.engine.getCssScene();

    // Create Back Button in the DOM
    this.createBackButton();

    // Create CSS3D Tile Elements
    this.createTiles();

    // Setup navigation listeners to manage tile visibility
    this.setupNavigationListeners();

    // Secret option: logo click listener
    const navbarLogo = document.getElementById('navbar-logo');
    if (navbarLogo) {
      navbarLogo.style.cursor = 'pointer';
      navbarLogo.addEventListener('click', () => {
        if (this.isActive && this.viewMode === 'table') {
          this.showSecretResumeAdminModal();
        }
      });
    }
  }

  private rebuildTiles(): void {
    if (!this.cssSceneRef) return;

    // Remove old tiles
    this.tiles.forEach((tile) => {
      this.cssSceneRef!.remove(tile);
    });
    this.tiles = [];

    // Re-create tiles
    this.createTiles();

    if (this.isActive) {
      // Show tiles
      this.tiles.forEach((tile) => {
        const el = tile.element as HTMLElement;
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      });

      // Reset back button if visible and modal is NOT open
      if (this.backButton && this.viewMode === 'table' && !document.getElementById('resume-admin-modal')) {
        this.backButton.classList.add('visible');
      }

      // Refresh layout immediately
      this.transitionToMode(this.viewMode, 0.8);
    }
  }

  private showSecretResumeAdminModal(): void {
    // Hide back button when configurator popup is active
    if (this.backButton) {
      this.backButton.classList.remove('visible');
    }

    // Remove existing modal if any
    const existing = document.getElementById('resume-admin-modal');
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'resume-admin-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.backgroundColor = 'rgba(10, 10, 18, 0.85)';
    modal.style.backdropFilter = 'blur(10px)';
    (modal.style as any).webkitBackdropFilter = 'blur(10px)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.fontFamily = "'Courier New', Courier, monospace";
    modal.style.color = '#fff';

    const content = document.createElement('div');
    content.className = 'resume-admin-content';
    content.style.width = '90%';
    content.style.maxWidth = '650px';
    content.style.maxHeight = '85vh';
    content.style.overflowY = 'auto';
    content.style.background = 'rgba(15, 23, 42, 0.75)';
    content.style.border = '1px solid #00ff88';
    content.style.boxShadow = '0 0 25px rgba(0, 255, 136, 0.2)';
    content.style.borderRadius = '12px';
    content.style.padding = '24px';
    content.style.position = 'relative';

    const header = document.createElement('h2');
    header.innerHTML = '⚡ RESUME SOURCE CONFIGURATOR';
    header.style.color = '#00ff88';
    header.style.fontSize = '1.3rem';
    header.style.marginBottom = '20px';
    header.style.borderBottom = '1px solid rgba(0, 255, 136, 0.3)';
    header.style.paddingBottom = '10px';
    header.style.textShadow = '0 0 10px rgba(0, 255, 136, 0.5)';
    content.appendChild(header);

    const closeModal = () => {
      modal.remove();
      // Restore back button if we are still in table mode
      if (this.backButton && this.viewMode === 'table') {
        this.backButton.classList.add('visible');
      }
    };

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '15px';
    closeBtn.style.right = '15px';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#00ff88';
    closeBtn.style.fontSize = '1.5rem';
    closeBtn.style.cursor = 'pointer';
    closeBtn.addEventListener('click', closeModal);
    content.appendChild(closeBtn);

    const itemsContainer = document.createElement('div');
    itemsContainer.style.display = 'flex';
    itemsContainer.style.flexDirection = 'column';
    itemsContainer.style.gap = '15px';
    itemsContainer.style.marginBottom = '25px';

    const renderItems = () => {
      itemsContainer.innerHTML = '';
      this.resumeList.forEach((item, index) => {
        const row = document.createElement('div');
        row.style.background = 'rgba(255, 255, 255, 0.03)';
        row.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        row.style.borderRadius = '6px';
        row.style.padding = '12px';
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '8px';

        const rowHeader = document.createElement('div');
        rowHeader.style.display = 'flex';
        rowHeader.style.justifyContent = 'space-between';
        rowHeader.style.alignItems = 'center';

        const itemTitle = document.createElement('span');
        itemTitle.innerHTML = `<strong>[${item.symbol}]</strong> ${item.title}`;
        itemTitle.style.color = '#00f0ff';
        rowHeader.appendChild(itemTitle);

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '10px';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'EDIT';
        editBtn.style.background = 'rgba(0, 240, 255, 0.1)';
        editBtn.style.border = '1px solid #00f0ff';
        editBtn.style.color = '#00f0ff';
        editBtn.style.padding = '4px 8px';
        editBtn.style.borderRadius = '4px';
        editBtn.style.cursor = 'pointer';
        editBtn.style.fontSize = '0.75rem';
        editBtn.addEventListener('click', () => showForm(index));
        actions.appendChild(editBtn);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'DELETE';
        delBtn.style.background = 'rgba(255, 0, 80, 0.1)';
        delBtn.style.border = '1px solid #ff0050';
        delBtn.style.color = '#ff0050';
        delBtn.style.padding = '4px 8px';
        delBtn.style.borderRadius = '4px';
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontSize = '0.75rem';
        delBtn.addEventListener('click', () => {
          if (confirm(`Are you sure you want to delete ${item.title}?`)) {
            this.resumeList.splice(index, 1);
            this.saveResumeList();
            this.rebuildTiles();
            renderItems();
          }
        });
        actions.appendChild(delBtn);

        rowHeader.appendChild(actions);
        row.appendChild(rowHeader);

        const detailsLine = document.createElement('div');
        detailsLine.style.fontSize = '0.8rem';
        detailsLine.style.color = '#aaa';
        detailsLine.textContent = `${item.details} | ${item.stack}`;
        row.appendChild(detailsLine);

        const linkLine = document.createElement('div');
        linkLine.style.fontSize = '0.75rem';
        linkLine.style.color = '#888';
        linkLine.style.wordBreak = 'break-all';
        linkLine.innerHTML = `<span style="color:#00ff88;">PDF URL:</span> ${item.pdfUrl || 'N/A'}`;
        row.appendChild(linkLine);

        itemsContainer.appendChild(row);
      });
    };

    const formContainer = document.createElement('div');
    formContainer.style.display = 'none';
    formContainer.style.background = 'rgba(0, 0, 0, 0.4)';
    formContainer.style.border = '1px solid #00f0ff';
    formContainer.style.borderRadius = '8px';
    formContainer.style.padding = '16px';
    formContainer.style.marginBottom = '20px';

    const formTitle = document.createElement('h3');
    formTitle.style.color = '#00f0ff';
    formTitle.style.fontSize = '1rem';
    formTitle.style.marginBottom = '12px';
    formContainer.appendChild(formTitle);

    const inputGrid = document.createElement('div');
    inputGrid.className = 'resume-admin-grid';
    inputGrid.style.display = 'grid';
    inputGrid.style.gridTemplateColumns = '1fr 1fr';
    inputGrid.style.gap = '10px';
    inputGrid.style.marginBottom = '12px';

    const createField = (label: string, id: string) => {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '4px';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      lbl.style.fontSize = '0.75rem';
      lbl.style.color = '#888';
      const input = document.createElement('input');
      input.id = `field-${id}`;
      input.style.background = '#0a0a14';
      input.style.border = '1px solid rgba(255, 255, 255, 0.15)';
      input.style.color = '#fff';
      input.style.padding = '6px';
      input.style.borderRadius = '4px';
      input.style.fontFamily = 'inherit';
      input.style.fontSize = '0.85rem';
      container.appendChild(lbl);
      container.appendChild(input);
      return container;
    };

    inputGrid.appendChild(createField('Symbol (e.g. CT)', 'symbol'));
    inputGrid.appendChild(createField('Number (e.g. 01)', 'number'));
    inputGrid.appendChild(createField('Title', 'title'));
    inputGrid.appendChild(createField('Details', 'details'));

    formContainer.appendChild(inputGrid);

    // Full width fields
    const stackField = createField('Stack / Skills', 'stack');
    stackField.style.marginBottom = '12px';
    formContainer.appendChild(stackField);

    const pdfField = createField('Google Drive PDF URL', 'pdfUrl');
    pdfField.style.marginBottom = '16px';
    formContainer.appendChild(pdfField);

    const formActions = document.createElement('div');
    formActions.className = 'resume-admin-actions';
    formActions.style.display = 'flex';
    formActions.style.gap = '12px';

    let currentEditingIndex: number | null = null;

    const saveFormBtn = document.createElement('button');
    saveFormBtn.textContent = 'SAVE ITEM';
    saveFormBtn.style.background = '#00ff88';
    saveFormBtn.style.border = 'none';
    saveFormBtn.style.color = '#000';
    saveFormBtn.style.padding = '8px 16px';
    saveFormBtn.style.borderRadius = '4px';
    saveFormBtn.style.fontWeight = 'bold';
    saveFormBtn.style.cursor = 'pointer';
    saveFormBtn.addEventListener('click', () => {
      const symbol = (document.getElementById('field-symbol') as HTMLInputElement).value;
      const number = (document.getElementById('field-number') as HTMLInputElement).value;
      const title = (document.getElementById('field-title') as HTMLInputElement).value;
      const details = (document.getElementById('field-details') as HTMLInputElement).value;
      const stack = (document.getElementById('field-stack') as HTMLInputElement).value;
      const pdfUrl = (document.getElementById('field-pdfUrl') as HTMLInputElement).value;

      if (!symbol || !title || !number) {
        alert('Symbol, Number, and Title are required!');
        return;
      }

      const itemData: ResumeData = { symbol, number, title, details, stack, pdfUrl };

      if (currentEditingIndex === null) {
        this.resumeList.push(itemData);
      } else {
        this.resumeList[currentEditingIndex] = itemData;
      }

      this.saveResumeList();
      this.rebuildTiles();
      formContainer.style.display = 'none';
      renderItems();
    });
    formActions.appendChild(saveFormBtn);

    const cancelFormBtn = document.createElement('button');
    cancelFormBtn.textContent = 'CANCEL';
    cancelFormBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    cancelFormBtn.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    cancelFormBtn.style.color = '#fff';
    cancelFormBtn.style.padding = '8px 16px';
    cancelFormBtn.style.borderRadius = '4px';
    cancelFormBtn.style.cursor = 'pointer';
    cancelFormBtn.addEventListener('click', () => {
      formContainer.style.display = 'none';
    });
    formActions.appendChild(cancelFormBtn);

    formContainer.appendChild(formActions);

    const showForm = (index: number | null) => {
      currentEditingIndex = index;
      formContainer.style.display = 'block';

      if (index === null) {
        formTitle.textContent = '➕ ADD NEW RESUME ITEM';
        (document.getElementById('field-symbol') as HTMLInputElement).value = '';
        (document.getElementById('field-number') as HTMLInputElement).value = '';
        (document.getElementById('field-title') as HTMLInputElement).value = '';
        (document.getElementById('field-details') as HTMLInputElement).value = '';
        (document.getElementById('field-stack') as HTMLInputElement).value = '';
        (document.getElementById('field-pdfUrl') as HTMLInputElement).value = '';
      } else {
        formTitle.textContent = `✏️ EDIT ITEM #${index + 1}`;
        const item = this.resumeList[index];
        (document.getElementById('field-symbol') as HTMLInputElement).value = item.symbol || '';
        (document.getElementById('field-number') as HTMLInputElement).value = item.number || '';
        (document.getElementById('field-title') as HTMLInputElement).value = item.title || '';
        (document.getElementById('field-details') as HTMLInputElement).value = item.details || '';
        (document.getElementById('field-stack') as HTMLInputElement).value = item.stack || '';
        (document.getElementById('field-pdfUrl') as HTMLInputElement).value = item.pdfUrl || '';
      }

      formContainer.scrollIntoView({ behavior: 'smooth' });
    };

    content.appendChild(formContainer);
    content.appendChild(itemsContainer);

    // Add New Item Button
    const addNewBtn = document.createElement('button');
    addNewBtn.textContent = '➕ ADD NEW ITEM';
    addNewBtn.style.background = '#00f0ff';
    addNewBtn.style.border = 'none';
    addNewBtn.style.color = '#000';
    addNewBtn.style.padding = '10px 20px';
    addNewBtn.style.borderRadius = '4px';
    addNewBtn.style.fontWeight = 'bold';
    addNewBtn.style.cursor = 'pointer';
    addNewBtn.style.width = '100%';
    addNewBtn.addEventListener('click', () => showForm(null));
    content.appendChild(addNewBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);

    renderItems();
  }

  private createBackButton(): void {
    const existing = document.getElementById('resume-back-btn');
    if (existing) {
      existing.remove();
    }

    this.backButton = document.createElement('button');
    this.backButton.id = 'resume-back-btn';
    this.backButton.className = 'resume-back-btn';
    this.backButton.style.zIndex = '10000'; // Ensure it's above other elements like canvas
    this.backButton.innerHTML = '&larr; BACK TO RESUME SPHERE';
    
    // Add to ui-layer instead of body to ensure proper stacking with other UI elements
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) {
      uiLayer.appendChild(this.backButton);
    } else {
      document.body.appendChild(this.backButton);
    }

    this.backButton.addEventListener('click', () => {
      this.transitionToMode('sphere');
    });
  }

  private createTiles(): void {
    if (!this.cssSceneRef) return;

    this.resumeList.forEach((data, index) => {
      // Create DOM element for the tile
      const element = document.createElement('div');
      element.className = 'resume-tile';

      const number = document.createElement('div');
      number.className = 'number';
      number.textContent = data.number;
      element.appendChild(number);

      const symbol = document.createElement('div');
      symbol.className = 'symbol';
      symbol.textContent = data.symbol;
      element.appendChild(symbol);

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = data.title;
      element.appendChild(title);

      const details = document.createElement('div');
      details.className = 'details';
      details.innerHTML = `${data.details}<br><span style="color:#00ff88;">${data.stack}</span>`;
      element.appendChild(details);

      // Create CSS3D Object wrapper
      const cssObject = new CSS3DObject(element);
      
      // Initial state: hidden, random positions
      cssObject.position.set(
        Math.random() * 40 - 20,
        Math.random() * 40 - 20,
        Math.random() * 40 - 20
      );
      cssObject.scale.set(0.010, 0.010, 0.010); // Scale down HTML units to match WebGL space units

      // Bind click handler
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleTileClick(index);
      });

      // Hide initially
      element.style.opacity = '0';
      element.style.pointerEvents = 'none';

      this.cssSceneRef!.add(cssObject);
      this.tiles.push(cssObject);
    });
  }

  private setupNavigationListeners(): void {
    if (!this.eventBus) return;

    this.eventBus.on(`${Domain.NAV}:${Action.NAVIGATE}` as AppEventName, (payload: any) => {
      const target = typeof payload === 'string' ? payload : payload?.target;
      if (target === 'resume') {
        this.isActive = true;
        this.showTiles();
      } else {
        this.isActive = false;
        this.hideTiles();
      }
    });
  }

  private showTiles(): void {
    // Reveal and transition tiles into the Sphere layout
    this.tiles.forEach((tile) => {
      const el = tile.element as HTMLElement;
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
    });
    this.transitionToMode('sphere', 1.5);
  }

  private hideTiles(): void {
    // Hide tiles and back button
    this.tiles.forEach((tile) => {
      const el = tile.element as HTMLElement;
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    });
    if (this.backButton) {
      this.backButton.classList.remove('visible');
    }
  }

  public handleCentralHubClick(): void {
    if (!this.isActive) return;
    if (this.viewMode === 'sphere') {
      this.transitionToMode('table');
    } else {
      this.transitionToMode('sphere');
    }
  }

  private handleTileClick(index: number): void {
    if (this.viewMode === 'sphere') {
      // Transition all tiles into the Table Style layout in empty space above
      this.transitionToMode('table');
    } else {
      // Open Google Drive link in a new tab!
      const data = this.resumeList[index];
      if (data && data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      } else {
        alert('No PDF link shared through Google Drive is configured for this item.');
      }
    }
  }

  private transitionToMode(mode: 'sphere' | 'table', duration: number = 1.2): void {
    this.viewMode = mode;
    gsap.killTweensOf(this.tiles.map(t => t.position));
    gsap.killTweensOf(this.tiles.map(t => t.rotation));

    const hubPos = this.mesh.position.clone();

    const isMobile = window.innerWidth < 768;

    if (mode === 'sphere') {
      // 1. Hide Back button
      if (this.backButton) {
        this.backButton.classList.remove('visible');
      }

      // 2. Arrange tiles in a beautiful sphere around the ResumeActor mesh
      const radius = isMobile ? 2.0 : 2.4;
      const count = this.tiles.length;

      this.tiles.forEach((tile, i) => {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;

        // Calculate sphere target coordinates
        const targetPos = new THREE.Vector3();
        targetPos.setFromSphericalCoords(radius, phi, theta);
        targetPos.add(hubPos);

        // Compute outward looking rotation
        const tempObj = new THREE.Object3D();
        tempObj.position.copy(targetPos);
        const lookTarget = targetPos.clone().sub(hubPos).multiplyScalar(2).add(hubPos);
        tempObj.lookAt(lookTarget);

        // Animate position and rotation (Tiles face outward from the sphere center)
        gsap.to(tile.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: duration,
          ease: 'power2.out'
        });

        gsap.to(tile.rotation, {
          x: tempObj.rotation.x,
          y: tempObj.rotation.y,
          z: tempObj.rotation.z,
          duration: duration,
          ease: 'power2.out'
        });
      });

      // 3. Move camera back to focus on original resume view
      const camZSphere = isMobile ? 9.5 : 7.5;
      this.eventBus.emit(`${Domain.CAMERA}:${Action.MOVE}` as AppEventName, {
        position: [hubPos.x, hubPos.y, hubPos.z + camZSphere],
        rotation: isMobile ? [0.2, 0, 0] : [0.2, 0.3, 0],
        fov: 65
      });

    } else if (mode === 'table') {
      // 1. Arrange tiles in a neat, centered grid (flying up to empty space)
      // We position the table higher up at y = original_y + 11
      const gridCenter = new THREE.Vector3(hubPos.x, hubPos.y + 13, hubPos.z - (isMobile ? 0 : 3));
      const count = this.tiles.length;
      const cols = isMobile ? 2 : 3;
      const spacingX = isMobile ? 1.3 : 1.8;
      const spacingY = isMobile ? 1.8 : 2.4;
      const totalRows = Math.ceil(count / cols);

      this.tiles.forEach((tile, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;

        // Number of items in this row (to center it horizontally)
        const rowItems = (row === totalRows - 1) ? (count % cols || cols) : cols;

        const offsetX = (col - (rowItems - 1) / 2) * spacingX;
        const offsetY = ((totalRows - 1) / 2 - row) * spacingY;
        const targetPos = new THREE.Vector3(gridCenter.x + offsetX, gridCenter.y + offsetY, gridCenter.z);

        // Tiles face the camera perfectly
        const targetRot = isMobile ? new THREE.Euler(0.2, 0, 0) : new THREE.Euler(0.2, 0.3, 0); // align rotation with camera view angle

        gsap.to(tile.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: duration,
          ease: 'power3.inOut'
        });

        gsap.to(tile.rotation, {
          x: targetRot.x,
          y: targetRot.y,
          z: targetRot.z,
          duration: duration,
          ease: 'power3.inOut'
        });
      });

      // 2. Animate camera to focus upwards onto the elevated resume table (at z + 5.5 to prevent being "way up close")
      const camZOffset = isMobile ? 8.5 : 5.5;
      this.eventBus.emit(`${Domain.CAMERA}:${Action.MOVE}` as AppEventName, {
        position: [hubPos.x, hubPos.y + 11, hubPos.z + camZOffset], // Move camera up and back to look at table grid comfortably
        rotation: isMobile ? [0.2, 0, 0] : [0.2, 0.3, 0],
        fov: 65
      });

      // 3. Show Back button with delay
      setTimeout(() => {
        if (this.viewMode === 'table' && this.backButton) {
          this.backButton.classList.add('visible');
        }
      }, duration * 1000);
    }
  }

  public update(time: number): void {
    // 1. Gentle continuous rotation of WebGL central hub mesh
    const hub = this.mesh.children[0];
    if (hub) {
      hub.rotation.y = time * 0.3;
      hub.rotation.x = time * 0.15;
    }

    // 2. Sphere continuous orbital drift
    if (this.isActive && this.viewMode === 'sphere') {
      this.autoRotationY = time * 0.08;
      const hubPos = this.mesh.position.clone();
      const isMobile = window.innerWidth < 768;
      const radius = isMobile ? 2.0 : 2.4;
      const count = this.tiles.length;

      this.tiles.forEach((tile, i) => {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi + this.autoRotationY;

        const targetPos = new THREE.Vector3();
        targetPos.setFromSphericalCoords(radius, phi, theta);
        targetPos.add(hubPos);

        tile.position.copy(targetPos);
        
        // Orient the tile to face outward from the sphere center
        const lookTarget = targetPos.clone().sub(hubPos).multiplyScalar(2).add(hubPos);
        tile.lookAt(lookTarget);
      });
    }
  }

  public dispose(): void {
    // Remove back button
    if (this.backButton && this.backButton.parentElement) {
      this.backButton.parentElement.removeChild(this.backButton);
    }

    // Clean up CSS3D elements from CSS Scene
    if (this.cssSceneRef) {
      this.tiles.forEach((tile) => {
        this.cssSceneRef!.remove(tile);
      });
    }
    this.tiles = [];
  }
}
