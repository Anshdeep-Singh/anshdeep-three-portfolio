import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';
import { gsap } from 'gsap';
import { Domain, Action, AppEventName } from '../../types/events';

interface ProjectData {
  symbol: string; // The 3D template ID (e.g. 'SpaceExplorer', 'CyberDrone', etc.)
  title: string;
  number: string;
  details: string;
  stack: string;
  pdfUrl?: string;
}

export class ProjectActor extends BaseActor {
  private rings: THREE.Mesh[] = [];

  // Arrow navigation meshes
  private leftArrow!: THREE.Mesh;
  private rightArrow!: THREE.Mesh;

  // Carousel state
  public activeProjectIndex: number = 0;
  private projects: THREE.Group[] = [];
  private projectIds: string[] = [];
  
  public eventBus: any = null;
  private isActive: boolean = false;

  private appsScriptUrl: string = 'https://script.google.com/macros/s/AKfycbxzEo5n56qqww3_i--Rt6_t55BpoHtPz2Iq0t5Bqs1UJxw62iU-hlZKWblQhzBTfqTa/exec';

  private projectList: ProjectData[] = [];

  private defaultProjectList: ProjectData[] = [
    {
      symbol: 'SpaceExplorer',
      title: 'Space Explorer',
      number: '01',
      details: 'Orbital tracking and visualization platform.',
      stack: 'WebGL / Three.js',
      pdfUrl: ''
    },
    {
      symbol: 'CyberDrone',
      title: 'AI Cyber-Drone',
      number: '02',
      details: 'Autonomous navigation AI for micro-drones.',
      stack: 'Python / TensorFlow',
      pdfUrl: ''
    },
    {
      symbol: 'QuantumComputing',
      title: 'Quantum Computing',
      number: '03',
      details: 'Quantum algorithm simulator.',
      stack: 'Q# / React',
      pdfUrl: ''
    },
    {
      symbol: 'BioNeural',
      title: 'Bio-Neural Network',
      number: '04',
      details: 'Neural interface bridging software and bio-signals.',
      stack: 'C++ / Neuralink API',
      pdfUrl: ''
    }
  ];

  constructor() {
    super('projects-showcase');
    this.loadProjectList();
  }

  private async loadProjectList(): Promise<void> {
    const saved = localStorage.getItem('project-list-data');
    if (saved) {
      try {
        this.projectList = JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved project list:', e);
        this.projectList = [...this.defaultProjectList];
      }
    } else {
      this.projectList = [...this.defaultProjectList];
    }

    if (this.appsScriptUrl) {
      try {
        const fetchUrl = this.appsScriptUrl.includes('?') ? `${this.appsScriptUrl}&sheet=Projects` : `${this.appsScriptUrl}?sheet=Projects`;
        const response = await fetch(fetchUrl);
        if (response.ok) {
          const remoteData = await response.json();
          if (Array.isArray(remoteData) && remoteData.length > 0) {
            this.projectList = remoteData;
            localStorage.setItem('project-list-data', JSON.stringify(this.projectList));
            this.rebuildCarousel();
          }
        }
      } catch (e) {
        console.error('Failed to fetch from Google Sheets, using local storage fallback:', e);
      }
    }
  }

  private saveProjectList(): void {
    localStorage.setItem('project-list-data', JSON.stringify(this.projectList));

    if (this.appsScriptUrl) {
      const postUrl = this.appsScriptUrl.includes('?') ? `${this.appsScriptUrl}&sheet=Projects` : `${this.appsScriptUrl}?sheet=Projects`;
      fetch(postUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(this.projectList)
      })
      .then(() => {
        console.log('Saved projects to Google Sheets successfully!');
      })
      .catch((e) => {
        console.error('Failed to save to Google Sheets:', e);
      });
    }
  }

  public setup(): void {
    const app = (window as any).app;
    if (app) {
      this.eventBus = app.eventBus;
      this.setupNavigationListeners();
    }

    // Common Rings
    const ringGeo = new THREE.RingGeometry(2.5, 2.6, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x3a3d52,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3
    });

    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2 + (i * 0.2);
      ring.rotation.y = i * 0.5;
      this.mesh.add(ring);
      this.rings.push(ring);
    }

    // Navigation Arrows
    const arrowGeo = new THREE.ConeGeometry(0.15, 0.35, 4);
    
    // Left Arrow
    const leftArrowMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.8
    });
    this.leftArrow = new THREE.Mesh(arrowGeo, leftArrowMat);
    this.leftArrow.position.set(-1.8, 0, 0);
    this.leftArrow.rotation.z = Math.PI / 2;
    this.leftArrow.name = 'Left Arrow';
    (this.leftArrow as any).entityId = 'projects-arrow-left';
    this.mesh.add(this.leftArrow);

    const arrowOuterGeo = new THREE.ConeGeometry(0.22, 0.45, 4);
    const leftOuterMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    const leftOuter = new THREE.Mesh(arrowOuterGeo, leftOuterMat);
    this.leftArrow.add(leftOuter);

    // Right Arrow
    const rightArrowMat = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      transparent: true,
      opacity: 0.8
    });
    this.rightArrow = new THREE.Mesh(arrowGeo, rightArrowMat);
    this.rightArrow.position.set(1.8, 0, 0);
    this.rightArrow.rotation.z = -Math.PI / 2;
    this.rightArrow.name = 'Right Arrow';
    (this.rightArrow as any).entityId = 'projects-arrow-right';
    this.mesh.add(this.rightArrow);

    const rightOuterMat = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    const rightOuter = new THREE.Mesh(arrowOuterGeo, rightOuterMat);
    this.rightArrow.add(rightOuter);

    // Build initial carousel
    this.buildCarousel();

    // Secret option: logo click listener
    const navbarLogo = document.getElementById('navbar-logo');
    if (navbarLogo) {
      navbarLogo.style.cursor = 'pointer';
      navbarLogo.addEventListener('click', () => {
        if (this.isActive) {
          this.showSecretProjectAdminModal();
        }
      });
    }
  }

  private setupNavigationListeners(): void {
    if (!this.eventBus) return;
    this.eventBus.on(`${Domain.NAV}:${Action.NAVIGATE}` as AppEventName, (payload: any) => {
      const target = typeof payload === 'string' ? payload : payload?.target;
      if (target === 'projects') {
        this.isActive = true;
      } else {
        this.isActive = false;
      }
    });

    // Listen to custom mobile/HTML navigation triggers for the projects carousel
    this.eventBus.on('PROJECT_CAROUSEL:NAVIGATE' as any, (payload: any) => {
      if (payload && payload.direction) {
        this.navigateCarousel(payload.direction);
      }
    });
  }

  private buildCarousel(): void {
    this.projects.forEach(p => this.mesh.remove(p));
    this.projects = [];
    this.projectIds = [];

    this.projectList.forEach((data, index) => {
      let group: THREE.Group;
      switch (data.symbol) {
        case 'SpaceExplorer':
          group = this.createSpaceExplorer(data);
          break;
        case 'CyberDrone':
          group = this.createCyberDrone(data);
          break;
        case 'QuantumComputing':
          group = this.createQuantumComputing(data);
          break;
        case 'BioNeural':
        default:
          group = this.createBioNeural(data);
          break;
      }
      
      this.mesh.add(group);
      this.projects.push(group);
      this.projectIds.push(`projects-dynamic-${index}`);
      
      // Update entityIds inside group children for raycasting
      group.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          (child as any).entityId = `projects-dynamic-${index}`;
        }
      });

      group.position.set(0, 0, 0);
      if (index === this.activeProjectIndex) {
        group.scale.set(1.0, 1.0, 1.0);
      } else {
        group.scale.set(0, 0, 0);
      }
    });

    if (this.activeProjectIndex >= this.projects.length && this.projects.length > 0) {
      this.activeProjectIndex = this.projects.length - 1;
      this.projects[this.activeProjectIndex].scale.set(1.0, 1.0, 1.0);
    }
  }

  private rebuildCarousel(): void {
    this.buildCarousel();
    // Refresh modal if open
    if (this.eventBus) {
      this.eventBus.emit('PROJECT_CAROUSEL:CHANGE', {
        activeProjectIndex: this.activeProjectIndex,
        contentId: this.projectIds[this.activeProjectIndex]
      });
    }
  }

  private createSpaceExplorer(data: ProjectData): THREE.Group {
    const group = new THREE.Group();
    group.name = data.title;
    const orbGeo = new THREE.IcosahedronGeometry(0.8, 2);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x00d2ff, roughness: 0.1, metalness: 0.8, wireframe: true
    });
    const spaceExplorerMesh = new THREE.Mesh(orbGeo, orbMat);
    spaceExplorerMesh.name = data.title;
    group.add(spaceExplorerMesh);

    const innerGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.6 });
    const spaceInner = new THREE.Mesh(innerGeo, innerMat);
    group.add(spaceInner);
    
    (group as any).templateType = 'SpaceExplorer';
    return group;
  }

  private createCyberDrone(data: ProjectData): THREE.Group {
    const group = new THREE.Group();
    group.name = data.title;
    
    const droneCoreGeo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
    const droneCoreMat = new THREE.MeshStandardMaterial({
      color: 0xffd700, roughness: 0.2, metalness: 0.9, emissive: 0x221a00
    });
    const droneCore = new THREE.Mesh(droneCoreGeo, droneCoreMat);
    droneCore.name = data.title;
    group.add(droneCore);

    const strutGeo = new THREE.BoxGeometry(1.2, 0.05, 0.05);
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8 });
    
    const strut1 = new THREE.Mesh(strutGeo, strutMat);
    strut1.rotation.y = Math.PI / 4;
    group.add(strut1);

    const strut2 = new THREE.Mesh(strutGeo, strutMat);
    strut2.rotation.y = -Math.PI / 4;
    group.add(strut2);

    const rotorGeo = new THREE.TorusGeometry(0.15, 0.03, 8, 24);
    const rotorMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.8 });
    const positions = [
      [0.42, 0.05, 0.42], [-0.42, 0.05, 0.42], [0.42, 0.05, -0.42], [-0.42, 0.05, -0.42]
    ];

    positions.forEach(pos => {
      const rotor = new THREE.Mesh(rotorGeo, rotorMat);
      rotor.position.set(pos[0], pos[1], pos[2]);
      rotor.rotation.x = Math.PI / 2;
      group.add(rotor);
    });
    
    (group as any).templateType = 'CyberDrone';
    return group;
  }

  private createQuantumComputing(data: ProjectData): THREE.Group {
    const group = new THREE.Group();
    group.name = data.title;
    
    const boxGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xff007f, roughness: 0.2, metalness: 0.9,
    });
    const quantumComputingMesh = new THREE.Mesh(boxGeo, boxMat);
    quantumComputingMesh.name = data.title;
    group.add(quantumComputingMesh);

    const outerBoxGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const outerBoxMat = new THREE.MeshBasicMaterial({
      color: 0xff007f, wireframe: true, transparent: true, opacity: 0.4
    });
    const quantumOuter = new THREE.Mesh(outerBoxGeo, outerBoxMat);
    group.add(quantumOuter);
    
    (group as any).templateType = 'QuantumComputing';
    return group;
  }

  private createBioNeural(data: ProjectData): THREE.Group {
    const group = new THREE.Group();
    group.name = data.title;
    
    const bioCoreGeo = new THREE.SphereGeometry(0.55, 16, 16);
    const bioCoreMat = new THREE.MeshStandardMaterial({
      color: 0x39ff14, roughness: 0.3, metalness: 0.7, wireframe: true
    });
    const bioCore = new THREE.Mesh(bioCoreGeo, bioCoreMat);
    bioCore.name = data.title;
    group.add(bioCore);

    const knotGeo = new THREE.TorusKnotGeometry(0.7, 0.12, 64, 8);
    const knotMat = new THREE.MeshBasicMaterial({
      color: 0x39ff14, wireframe: true, transparent: true, opacity: 0.4
    });
    const bioKnot = new THREE.Mesh(knotGeo, knotMat);
    bioKnot.name = 'Bio-Neural Knot';
    group.add(bioKnot);
    
    (group as any).templateType = 'BioNeural';
    return group;
  }

  public update(time: number): void {
    // Rotate active projects
    this.projects.forEach(group => {
      if (group.scale.x > 0.01) {
        const type = (group as any).templateType;
        if (type === 'SpaceExplorer') {
          group.rotation.y = time * 0.5;
          group.rotation.x = time * 0.2;
          group.position.y = Math.sin(time + 1) * 0.1;
        } else if (type === 'CyberDrone') {
          group.rotation.y = time * 0.6;
          group.position.y = Math.sin(time * 1.5) * 0.08;
          group.children.forEach(child => {
            if (child instanceof THREE.Mesh && child.name !== group.name) {
              child.rotation.z = time * 8;
            }
          });
        } else if (type === 'QuantumComputing') {
          group.rotation.y = -time * 0.4;
          group.rotation.z = time * 0.3;
          group.position.y = Math.sin(time * 1.2) * 0.1;
        } else if (type === 'BioNeural') {
          group.rotation.y = time * 0.3;
          group.position.y = Math.sin(time * 0.8) * 0.09;
          const knot = group.getObjectByName('Bio-Neural Knot');
          if (knot) {
            knot.rotation.x = time * 0.6;
            knot.rotation.y = -time * 0.8;
          }
        }
      }
    });

    // Spin orbital rings
    this.rings.forEach((ring, index) => {
      ring.rotation.z = time * (0.05 * (index + 1));
    });

    // Animate Navigation Arrows
    if (this.leftArrow && this.rightArrow) {
      this.leftArrow.position.y = Math.sin(time * 2.0) * 0.05;
      this.rightArrow.position.y = Math.sin(time * 2.0) * 0.05;
      
      const pulse = 0.6 + Math.sin(time * 3.0) * 0.25;
      (this.leftArrow.material as THREE.MeshBasicMaterial).opacity = pulse;
      (this.rightArrow.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
  }

  public navigateCarousel(direction: 'left' | 'right'): void {
    const totalCount = this.projects.length;
    
    if (totalCount <= 1) {
      return;
    }

    const prevIndex = this.activeProjectIndex;
    let nextIndex = prevIndex;

    if (direction === 'left') {
      nextIndex = (prevIndex - 1 + totalCount) % totalCount;
    } else {
      nextIndex = (prevIndex + 1) % totalCount;
    }

    if (nextIndex === prevIndex) return;

    this.activeProjectIndex = nextIndex;

    const currentMesh = this.projects[prevIndex];
    const nextMesh = this.projects[nextIndex];

    gsap.to(currentMesh.scale, {
      x: 0, y: 0, z: 0, duration: 0.6, ease: 'power2.inOut', overwrite: 'auto'
    });
    gsap.to(currentMesh.rotation, {
      y: currentMesh.rotation.y + Math.PI * 3, duration: 0.6, ease: 'power2.inOut', overwrite: 'auto'
    });

    nextMesh.scale.set(0, 0, 0);
    nextMesh.rotation.y = 0;

    gsap.to(nextMesh.scale, {
      x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(1.5)', delay: 0.1, overwrite: 'auto'
    });
    gsap.to(nextMesh.rotation, {
      y: Math.PI * 2, duration: 0.8, ease: 'power2.out', delay: 0.1, overwrite: 'auto'
    });

    if (this.eventBus) {
      const nextContentId = this.projectIds[nextIndex];
      this.eventBus.emit('PROJECT_CAROUSEL:CHANGE', {
        activeProjectIndex: nextIndex,
        contentId: nextContentId
      });
      this.eventBus.emit('MODAL:OPEN', { contentId: nextContentId });
    }
  }

  public reconstruct(_year: number): void {
    const unlockedCount = this.projects.length;

    if (this.activeProjectIndex >= unlockedCount) {
      this.activeProjectIndex = Math.max(0, unlockedCount - 1);
    }

    this.projects.forEach((proj, index) => {
      const isCurrentActive = index === this.activeProjectIndex;
      const targetScale = isCurrentActive ? 1.0 : 0.0;

      gsap.to(proj.scale, {
        x: targetScale, y: targetScale, z: targetScale, duration: 1.5, ease: 'power2.out', overwrite: 'auto'
      });
    });

    const arrowScale = unlockedCount > 1 ? 1.0 : 0.0;
    if (this.leftArrow && this.rightArrow) {
      gsap.to(this.leftArrow.scale, {
        x: arrowScale, y: arrowScale, z: arrowScale, duration: 1.0, ease: 'power2.out', overwrite: 'auto'
      });
      gsap.to(this.rightArrow.scale, {
        x: arrowScale, y: arrowScale, z: arrowScale, duration: 1.0, ease: 'power2.out', overwrite: 'auto'
      });
    }

    this.rings.forEach(ring => {
      gsap.to(ring.scale, {
        x: 1.0, y: 1.0, z: 1.0, duration: 1.5, ease: 'power2.out', overwrite: 'auto'
      });
    });
  }

  private showSecretProjectAdminModal(): void {
    const existing = document.getElementById('project-admin-modal');
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'project-admin-modal';
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
    content.className = 'project-admin-content';
    content.style.width = '90%';
    content.style.maxWidth = '650px';
    content.style.maxHeight = '85vh';
    content.style.overflowY = 'auto';
    content.style.background = 'rgba(15, 23, 42, 0.75)';
    content.style.border = '1px solid #00d2ff';
    content.style.boxShadow = '0 0 25px rgba(0, 210, 255, 0.2)';
    content.style.borderRadius = '12px';
    content.style.padding = '24px';
    content.style.position = 'relative';

    const header = document.createElement('h2');
    header.innerHTML = '⚡ PROJECT SOURCE CONFIGURATOR';
    header.style.color = '#00d2ff';
    header.style.fontSize = '1.3rem';
    header.style.marginBottom = '20px';
    header.style.borderBottom = '1px solid rgba(0, 210, 255, 0.3)';
    header.style.paddingBottom = '10px';
    header.style.textShadow = '0 0 10px rgba(0, 210, 255, 0.5)';
    content.appendChild(header);

    const closeModal = () => {
      modal.remove();
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '15px';
    closeBtn.style.right = '15px';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#00d2ff';
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
      this.projectList.forEach((item, index) => {
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
        itemTitle.style.color = '#00d2ff';
        rowHeader.appendChild(itemTitle);

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '10px';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'EDIT';
        editBtn.style.background = 'rgba(0, 210, 255, 0.1)';
        editBtn.style.border = '1px solid #00d2ff';
        editBtn.style.color = '#00d2ff';
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
            this.projectList.splice(index, 1);
            this.saveProjectList();
            this.rebuildCarousel();
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

        itemsContainer.appendChild(row);
      });
    };

    const formContainer = document.createElement('div');
    formContainer.style.display = 'none';
    formContainer.style.background = 'rgba(0, 0, 0, 0.4)';
    formContainer.style.border = '1px solid #00d2ff';
    formContainer.style.borderRadius = '8px';
    formContainer.style.padding = '16px';
    formContainer.style.marginBottom = '20px';

    const formTitle = document.createElement('h3');
    formTitle.style.color = '#00d2ff';
    formTitle.style.fontSize = '1rem';
    formTitle.style.marginBottom = '12px';
    formContainer.appendChild(formTitle);

    const inputGrid = document.createElement('div');
    inputGrid.style.display = 'grid';
    inputGrid.style.gridTemplateColumns = window.innerWidth < 768 ? '1fr' : '1fr 1fr';
    inputGrid.style.gap = '10px';
    inputGrid.style.marginBottom = '12px';

    const createField = (label: string, id: string, isSelect = false, options: string[] = []) => {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '4px';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      lbl.style.fontSize = '0.75rem';
      lbl.style.color = '#888';
      
      let input: HTMLInputElement | HTMLSelectElement;
      if (isSelect) {
        input = document.createElement('select');
        options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          input.appendChild(option);
        });
      } else {
        input = document.createElement('input');
      }
      
      input.id = `proj-field-${id}`;
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

    inputGrid.appendChild(createField('Template (Symbol)', 'symbol', true, ['SpaceExplorer', 'CyberDrone', 'QuantumComputing', 'BioNeural']));
    inputGrid.appendChild(createField('Number (e.g. 01)', 'number'));
    inputGrid.appendChild(createField('Title', 'title'));
    inputGrid.appendChild(createField('Details', 'details'));

    formContainer.appendChild(inputGrid);

    const stackField = createField('Stack / Skills', 'stack');
    stackField.style.marginBottom = '12px';
    formContainer.appendChild(stackField);

    const pdfField = createField('Google Drive PDF URL', 'pdfUrl');
    pdfField.style.marginBottom = '16px';
    formContainer.appendChild(pdfField);

    const formActions = document.createElement('div');
    formActions.style.display = 'flex';
    formActions.style.gap = '12px';

    let currentEditingIndex: number | null = null;

    const saveFormBtn = document.createElement('button');
    saveFormBtn.textContent = 'SAVE ITEM';
    saveFormBtn.style.background = '#00d2ff';
    saveFormBtn.style.border = 'none';
    saveFormBtn.style.color = '#000';
    saveFormBtn.style.padding = '8px 16px';
    saveFormBtn.style.borderRadius = '4px';
    saveFormBtn.style.fontWeight = 'bold';
    saveFormBtn.style.cursor = 'pointer';
    saveFormBtn.addEventListener('click', () => {
      const symbol = (document.getElementById('proj-field-symbol') as HTMLSelectElement).value;
      const number = (document.getElementById('proj-field-number') as HTMLInputElement).value;
      const title = (document.getElementById('proj-field-title') as HTMLInputElement).value;
      const details = (document.getElementById('proj-field-details') as HTMLInputElement).value;
      const stack = (document.getElementById('proj-field-stack') as HTMLInputElement).value;
      const pdfUrl = (document.getElementById('proj-field-pdfUrl') as HTMLInputElement).value;

      if (!symbol || !title || !number) {
        alert('Symbol (Template), Number, and Title are required!');
        return;
      }

      const itemData: ProjectData = { symbol, number, title, details, stack, pdfUrl };

      if (currentEditingIndex === null) {
        this.projectList.push(itemData);
      } else {
        this.projectList[currentEditingIndex] = itemData;
      }

      this.saveProjectList();
      this.rebuildCarousel();
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
        formTitle.textContent = '➕ ADD NEW PROJECT';
        (document.getElementById('proj-field-symbol') as HTMLSelectElement).value = 'SpaceExplorer';
        (document.getElementById('proj-field-number') as HTMLInputElement).value = '';
        (document.getElementById('proj-field-title') as HTMLInputElement).value = '';
        (document.getElementById('proj-field-details') as HTMLInputElement).value = '';
        (document.getElementById('proj-field-stack') as HTMLInputElement).value = '';
        (document.getElementById('proj-field-pdfUrl') as HTMLInputElement).value = '';
      } else {
        formTitle.textContent = `✏️ EDIT PROJECT #${index + 1}`;
        const item = this.projectList[index];
        (document.getElementById('proj-field-symbol') as HTMLSelectElement).value = item.symbol || 'SpaceExplorer';
        (document.getElementById('proj-field-number') as HTMLInputElement).value = item.number || '';
        (document.getElementById('proj-field-title') as HTMLInputElement).value = item.title || '';
        (document.getElementById('proj-field-details') as HTMLInputElement).value = item.details || '';
        (document.getElementById('proj-field-stack') as HTMLInputElement).value = item.stack || '';
        (document.getElementById('proj-field-pdfUrl') as HTMLInputElement).value = item.pdfUrl || '';
      }

      formContainer.scrollIntoView({ behavior: 'smooth' });
    };

    content.appendChild(formContainer);
    content.appendChild(itemsContainer);

    const addNewBtn = document.createElement('button');
    addNewBtn.textContent = '➕ ADD NEW PROJECT';
    addNewBtn.style.background = '#00d2ff';
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
}
