<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { NEWCRISP_WIDGET, PROJECTS, SITE_PROFILE, type ProjectItem } from './config/projects';

const toastMessage = ref('');
let toastTimer: number | undefined;
let widgetScript: HTMLScriptElement | null = null;

function showToast(message: string) {
  toastMessage.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMessage.value = '';
  }, 3200);
}

function handlePendingEntry(project: ProjectItem) {
  if (project.status === 'deployed-pending-url') {
    showToast(`${project.name} 已部署到 ECS，在 src/config/projects.ts 填入线上域名即可直接跳转。`);
  } else {
    showToast(`${project.name} 正在筹备 ECS 部署，可先访问 GitHub 仓库查看源码与运行指南。`);
  }
}

async function copyRepoUrl(project: ProjectItem) {
  try {
    await navigator.clipboard.writeText(project.repoUrl);
    showToast(`已复制 ${project.name} 仓库地址`);
  } catch {
    showToast(project.repoUrl);
  }
}

function repoShortName(url: string) {
  return url.replace(/^https?:\/\/github\.com\//, '');
}

onMounted(() => {
  if (NEWCRISP_WIDGET.enabled && NEWCRISP_WIDGET.origin && NEWCRISP_WIDGET.siteId) {
    const script = document.createElement('script');
    script.src = `${NEWCRISP_WIDGET.origin.replace(/\/$/, '')}/widget.js`;
    script.async = true;
    script.dataset.siteId = NEWCRISP_WIDGET.siteId;
    document.body.appendChild(script);
    widgetScript = script;
  }
});

onUnmounted(() => {
  window.clearTimeout(toastTimer);
  widgetScript?.remove();
  document.getElementById('newcrisp-widget-root')?.remove();
});
</script>

<template>
  <header class="top-nav">
    <div class="container top-nav-inner">
      <a href="#top" class="brand-mark">
        <span class="brand-seal" aria-hidden="true">简</span>
        <span class="brand-text">
          <strong>{{ SITE_PROFILE.brand }}</strong>
          <span>{{ SITE_PROFILE.brandEn }}</span>
        </span>
      </a>

      <nav class="nav-links" aria-label="页面导航">
        <a href="#projects">项目作品</a>
        <a href="#ecosystem">系统协同</a>
        <a href="#stack">工程底座</a>
      </nav>

      <a class="btn" :href="SITE_PROFILE.githubProfile" target="_blank" rel="noopener noreferrer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.66.79.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
        </svg>
        <span>GitHub 主页</span>
      </a>
    </div>
  </header>

  <main id="top">
    <section class="hero">
      <div class="container hero-layout">
        <div>
          <span class="hero-badge">
            <span class="pulse-dot" aria-hidden="true"></span>
            {{ SITE_PROFILE.roleBadge }}
          </span>
          <h1>{{ SITE_PROFILE.headline }}</h1>
          <p class="hero-intro">{{ SITE_PROFILE.intro }}</p>
          <div class="hero-actions">
            <a href="#projects" class="btn btn-primary">浏览核心项目</a>
            <a :href="SITE_PROFILE.githubProfile" target="_blank" rel="noopener noreferrer" class="btn">
              查看全部开源仓库 ↗
            </a>
          </div>
        </div>

        <aside class="surface hero-metrics" aria-label="工程概览">
          <div v-for="item in SITE_PROFILE.metrics" :key="item.label" class="metric-row">
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </div>
        </aside>
      </div>
    </section>

    <section id="projects" class="section">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="section-kicker">Featured Systems</p>
            <h2>核心项目入口</h2>
          </div>
          <p>三套独立代码库，均含完整前后端、数据库迁移与自动化验收</p>
        </div>

        <div class="projects-grid">
          <article v-for="project in PROJECTS" :key="project.id" class="surface project-card">
            <div class="project-top">
              <div :class="['project-icon', project.accent]" aria-hidden="true">
                <!-- Nexus icon -->
                <svg v-if="project.id === 'nexus'" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
                <!-- FlowOps icon -->
                <svg v-else-if="project.id === 'flowops'" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="6" cy="6" r="2.5" />
                  <circle cx="18" cy="6" r="2.5" />
                  <circle cx="12" cy="18" r="2.5" />
                  <path d="M8.5 6h7M7.2 8.2l3.6 7.6M16.8 8.2l-3.6 7.6" />
                </svg>
                <!-- NewCrisp icon -->
                <svg v-else width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L4 21l1.5-4.4A8.5 8.5 0 1 1 21 12Z" />
                  <path d="M8.5 11.5h7M8.5 14.5h4.5" />
                </svg>
              </div>

              <span :class="['status-pill', project.liveUrl ? 'live' : project.status]">
                <i></i>
                {{ project.liveUrl ? '在线运行' : project.statusText }}
              </span>
            </div>

            <div class="project-title-group">
              <h3>{{ project.name }}</h3>
              <span class="project-subtitle">{{ project.subtitle }}</span>
            </div>

            <p class="project-tagline">{{ project.tagline }}</p>

            <ul class="project-highlights">
              <li v-for="point in project.highlights" :key="point">
                <svg class="check-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{{ point }}</span>
              </li>
            </ul>

            <div class="stack-tags">
              <span v-for="tech in project.stack" :key="tech" class="stack-tag">{{ tech }}</span>
            </div>

            <div class="project-actions">
              <a
                v-if="project.liveUrl"
                class="btn btn-primary"
                :href="project.liveUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ project.liveLabel }} ↗
              </a>
              <button
                v-else
                type="button"
                class="btn btn-pending"
                @click="handlePendingEntry(project)"
              >
                {{ project.status === 'deployed-pending-url' ? '在线入口（待填域名）' : '在线入口（部署筹备中）' }}
              </button>

              <a
                class="btn btn-icon"
                :href="project.repoUrl"
                target="_blank"
                rel="noopener noreferrer"
                :title="`打开 ${project.name} GitHub 仓库`"
                :aria-label="`打开 ${project.name} GitHub 仓库`"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.66.79.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                </svg>
              </a>
            </div>

            <div class="project-repo-row">
              <a class="repo-link" :href="project.repoUrl" target="_blank" rel="noopener noreferrer">
                <span>github.com/{{ repoShortName(project.repoUrl) }}</span>
              </a>
              <button type="button" class="copy-mini" @click="copyRepoUrl(project)">复制</button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="ecosystem" class="section">
      <div class="container">
        <div class="surface ecosystem-card">
          <p class="section-kicker">Architecture Synergy</p>
          <h2>三套系统的协同关系</h2>
          <p style="margin-top: 6px; color: var(--muted); font-size: 0.94rem;">
            并非孤立的玩具 Demo，而是围绕真实产品场景打通身份边界、实时通信与企业协作的全栈体系。
          </p>

          <div class="ecosystem-grid">
            <div class="eco-node">
              <strong>Nexus · 开发者平台</strong>
              <span>对外提供开放 API、配额与多端控制台，通过一次性 launch-grant 与画像同步无缝拉起在线客服。</span>
            </div>

            <div class="eco-connector" aria-hidden="true">
              <span>⇄</span>
              <span>单点接入 &amp; 未读角标</span>
            </div>

            <div class="eco-node">
              <strong>NewCrisp · 实时客服台</strong>
              <span>承接 Nexus 已登录用户与外部官网 Shadow DOM 悬浮窗访客，提供实时对话、协同备注与满意度分析。</span>
            </div>

            <div class="eco-connector" aria-hidden="true">
              <span>·</span>
              <span>同源工程底座</span>
            </div>

            <div class="eco-node">
              <strong>FlowOps · 工单与知识库</strong>
              <span>面向企业内部的深度异步工单流转、SLA 监控、消息队列通知与 Milvus 向量 AI 相似知识推荐。</span>
            </div>
          </div>

          <div id="stack" class="eco-base">
            <span class="eco-base-label">统一工程技术栈：</span>
            <span v-for="tech in SITE_PROFILE.coreStack" :key="tech" class="stack-tag">{{ tech }}</span>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <span>© {{ new Date().getFullYear() }} {{ SITE_PROFILE.brand }} · Built with Vue 3 &amp; Vite</span>
      <div class="footer-links">
        <a v-for="project in PROJECTS" :key="project.id" :href="project.repoUrl" target="_blank" rel="noopener noreferrer">
          {{ project.name }}
        </a>
        <a :href="SITE_PROFILE.githubProfile" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </div>
  </footer>

  <div v-if="toastMessage" class="toast" role="status" aria-live="polite">{{ toastMessage }}</div>
</template>
