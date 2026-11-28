<script setup lang="ts">
import { PROJECTS, SITE_PROFILE } from './config/projects'
import { buildings, chapters, districts, href, media, spots } from './catalog'
const props = defineProps<{ route: string }>()
const project = PROJECTS.find((p) => props.route === '/projects/' + p.id + '/')
const chapter = chapters.find((c) => c.project === project?.name)
const nav = [
  ['/#projects', '软件作品'],
  ['/explore/', '探索小镇'],
  ['/systems/', '系统实验室'],
  ['/studio/', '工作室'],
  ['/#about', '关于'],
]
const shorts = {
  nexus: '开发者 API 平台',
  flowops: '多租户工单与知识协作',
  newcrisp: '实时在线客服服务台',
}
const rooms = [
  {
    path: '/studio/',
    name: 'Studio',
    title: '个人工作室',
    image: 'inside',
    text: '沿工作台、书架和设计白板，查看项目用到的技术与学习主题。',
  },
  {
    path: '/creative/',
    name: 'Creative Lab',
    title: '创意收藏',
    image: 'collection',
    text: 'Frostwick 霜镇夜邮局，从独立雪景球到工作室里的收藏。',
  },
]
const pic = (name: string) => media(name + '.webp')
const daySet = [480, 800, 1280, 1800]
  .map((w) => media('day-' + w + '.webp') + ' ' + w + 'w')
  .join(', ')
</script>

<template>
  <div class="portfolio" id="top" :data-route="route">
    <a class="skip" href="#content">跳到正文</a>
    <header class="sitehead">
      <div class="shell headrow">
        <a class="signature" :href="href('/')"
          ><i class="seal" aria-hidden="true"><i /><i /><i /><i /></i>简小淼
          <em>Studio</em></a
        >
        <nav aria-label="主导航">
          <a
            v-for="[url, label] in nav"
            :key="url"
            :href="href(url)"
            :aria-current="url === route ? 'page' : undefined"
            >{{ label }}</a
          >
        </nav>
        <details class="menu">
          <summary>目录 ☰</summary>
          <nav aria-label="移动导航">
            <a v-for="[url, label] in nav" :key="url" :href="href(url)">{{
              label
            }}</a>
          </nav>
        </details>
      </div>
    </header>
    <main id="content">
      <template v-if="route === '/'">
        <section class="hero shell">
          <div class="welcome">
            <p class="ey">Welcome to my world</p>
            <h1>你好，<br />我是<span>简小淼。</span></h1>
            <h2>用代码建造一个小世界。</h2>
            <p class="intro">
              我是一名软件工程专业学生，喜欢通过实际项目探索后端开发与系统设计，也喜欢三维建模和交互式可视化。
            </p>
            <div class="actions">
              <a class="primarylink" :href="href('/explore/')"
                >探索小镇 <b>→</b></a
              ><a class="textlink" href="#projects">浏览软件作品 ↓</a>
            </div>
          </div>
          <figure class="world">
            <div class="world-frame" data-runtime-slot>
              <picture
                ><source
                  type="image/webp"
                  :srcset="daySet"
                  sizes="(max-width: 740px) 96vw, 61vw" />
                <img
                  :src="media('day.jpg')"
                  width="1800"
                  height="1238"
                  fetchpriority="high"
                  alt="Codeville 全景，滨水公园、住宅街与街市环绕四栋核心建筑"
              /></picture>
            </div>
            <figcaption>
              <div><em>Codeville</em><small>微缩开发者小镇</small></div>
              <button class="enable" data-enable hidden>启用三维预览 ↗</button>
            </figcaption>
          </figure>
        </section>
        <div class="counts">
          <div class="shell">
            <span><b>3</b> 个软件项目</span><span><b>3</b> 条系统演示</span
            ><span><b>1</b> 座微缩小镇</span>
          </div>
        </div>
        <section class="shell block" id="projects">
          <div class="sectionhead">
            <div>
              <p class="ey">Selected software</p>
              <h2>软件作品</h2>
            </div>
            <a :href="SITE_PROFILE.githubProfile">GitHub ↗</a>
          </div>
          <div class="projects">
            <a
              v-for="p in PROJECTS"
              :key="p.id"
              class="project"
              :href="href('/projects/' + p.id + '/')"
              ><img
                :src="pic(buildings[p.id])"
                :alt="p.name + ' 对应的小镇建筑'"
                loading="lazy"
                width="900"
                height="450"
              />
              <div class="titleline">
                <h3>{{ p.name }}</h3>
                <span>↗</span>
              </div>
              <p>{{ shorts[p.id] }}</p>
              <small>{{ p.stack.slice(0, 3).join(' · ') }}</small></a
            >
          </div>
        </section>
        <section class="labband" id="ecosystem">
          <div class="shell labgrid">
            <div>
              <p class="ey">Systems Lab</p>
              <h2>系统实验室</h2>
              <p>从一个请求、一张工单和一条消息，走进软件的运行过程。</p>
              <a class="textlink" :href="href('/systems/')">查看章节导读 →</a>
            </div>
            <div class="chapterlist">
              <a
                v-for="(c, i) in chapters"
                :key="c.id"
                :href="href('/systems/#' + c.id)"
                ><small>CH. 0{{ i + 1 }}</small
                ><b>{{ c.title }}</b
                ><span>↗</span></a
              >
            </div>
          </div>
        </section>
        <section class="shell block rooms" id="stack">
          <a v-for="r in rooms" :key="r.path" :href="href(r.path)"
            ><img :src="pic(r.image)" :alt="r.title" loading="lazy" />
            <p class="ey">{{ r.name }}</p>
            <h2>{{ r.title }} ↗</h2>
            <p>{{ r.text }}</p></a
          >
        </section>
        <section class="about" id="about">
          <div class="shell aboutgrid">
            <div>
              <p class="ey">About the maker</p>
              <h2>关于简小淼</h2>
            </div>
            <div>
              <p>{{ SITE_PROFILE.intro }}</p>
              <a class="textlink" :href="SITE_PROFILE.githubProfile"
                >GitHub · jianxiaomiao ↗</a
              >
            </div>
          </div>
        </section>
      </template>
      <template v-else-if="project && chapter">
        <div class="shell block">
          <a class="backlink" :href="href('/#projects')">← 软件作品</a>
          <section class="detailhero">
            <div>
              <p class="ey">Software project</p>
              <h1 class="latin">{{ project.name }}</h1>
              <h2>{{ shorts[project.id] }}</h2>
              <p>{{ project.tagline }}</p>
              <div class="actions">
                <a
                  class="primarylink"
                  :href="href('/explore/?place=' + buildings[project.id])"
                  >探访对应建筑 →</a
                ><a :href="project.repoUrl">GitHub 仓库 ↗</a>
              </div>
            </div>
            <figure>
              <img
                :src="pic(buildings[project.id])"
                :alt="project.name + ' 对应的 Codeville 建筑'"
              />
              <figcaption>
                Codeville ·
                {{
                  { NX: '科技研究所', FO: '任务调度中心', NC: '通信邮局' }[
                    buildings[project.id]
                  ]
                }}
              </figcaption>
            </figure>
          </section>
          <section class="reading">
            <aside>
              <p class="ey">Project notes</p>
              <a href="#engineering">工程实践</a><a href="#stack">项目技术栈</a>
            </aside>
            <div>
              <h2 id="engineering">工程实践</h2>
              <ul>
                <li v-for="item in project.highlights" :key="item">
                  {{ item }}
                </li>
              </ul>
              <h2 id="stack">项目技术栈</h2>
              <p>{{ project.stack.join('　·　') }}</p>
              <h2>相关系统演示</h2>
              <p>{{ chapter.text }}</p>
              <a class="textlink" :href="href('/systems/#' + chapter.id)"
                >阅读「{{ chapter.title }}」 →</a
              >
              <div class="actions">
                <a v-if="project.liveUrl" :href="project.liveUrl"
                  >{{ project.liveLabel }} ↗</a
                ><button hidden data-copy :data-url="project.repoUrl">
                  复制仓库地址</button
                ><output aria-live="polite" />
              </div>
            </div>
          </section>
        </div>
      </template>
      <section v-else-if="route === '/systems/'" class="shell block">
        <p class="ey">Systems Lab</p>
        <h1>系统实验室</h1>
        <p class="standfirst">
          在小镇中观察一次业务操作，也可以沿着文字读完整条链路。三章在浏览器内模拟。
        </p>
        <article
          v-for="(c, i) in chapters"
          :id="c.id"
          :key="c.id"
          class="chapterarticle"
        >
          <img :src="pic(c.image)" :alt="c.project + ' 的小镇建筑'" />
          <div>
            <p class="ey">Chapter 0{{ i + 1 }} · {{ c.project }}</p>
            <h2>{{ c.title }}</h2>
            <p>{{ c.text }}</p>
            <p class="branches">{{ c.branches }}</p>
            <a class="primarylink" :href="href('/explore/?chapter=' + c.id)"
              >打开章节配置 →</a
            >
            <details class="source-frame">
              <summary>阅读步骤与实际画面</summary>
              <ol>
                <li v-for="step in c.steps" :key="step">{{ step }}</li>
              </ol>
              <figure>
                <img
                  :src="pic(c.evidence)"
                  :alt="c.title + ' 的 Phase 8 原始演示截图'"
                  loading="lazy"
                />
                <figcaption>Phase 8 演示实录</figcaption>
              </figure>
            </details>
          </div>
        </article>
      </section>
      <section v-else-if="route === '/studio/'" class="shell block">
        <p class="ey">Personal workspace</p>
        <div class="detailhero">
          <div>
            <h1 class="latin">Studio</h1>
            <h2>个人工作室</h2>
            <p>在工作台上读项目，在书架前看技术，在白板旁梳理系统设计。</p>
            <a class="textlink" :href="href('/explore/?place=ST')"
              >走近工作室 →</a
            >
          </div>
          <img :src="pic('inside')" alt="工作室展开后的室内实景" />
        </div>
        <div class="reading">
          <aside>
            <p class="ey">Studio index</p>
            <a href="#tech">技术栈</a><a href="#interior">室内热点</a>
          </aside>
          <div>
            <h2 id="tech">书架上的技术栈</h2>
            <p v-for="p in PROJECTS" :key="p.id">
              <a :href="href('/projects/' + p.id + '/')"
                ><b>{{ p.name }} ↗</b></a
              >　{{ p.stack.join(' · ') }}
            </p>
            <h2>学习中的工程问题</h2>
            <p>
              同一次调用中，配额事务和后台用量如何分开？丢失回执时，同一张工单如何被识别？
            </p>
            <a class="textlink" :href="href('/systems/')"
              >前往系统实验室逐步观察 →</a
            >
            <h2 id="interior">室内热点</h2>
            <div class="spotlinks">
              <a
                v-for="[id, name, desc] in spots"
                :key="id"
                :href="href('/explore/?place=ST&hotspot=' + id)"
                >{{ name }} · {{ desc }} →</a
              >
            </div>
          </div>
        </div>
      </section>
      <section
        v-else-if="route === '/creative/'"
        class="shell block"
        id="frostwick"
      >
        <p class="ey">Creative Lab · Collection</p>
        <div class="detailhero">
          <div>
            <h1 class="latin">Frostwick</h1>
            <h2>霜镇夜邮局</h2>
            <p>
              一件微缩雪景球收藏。钟楼、红邮车和黄铜铭牌藏在球罩中，也陈列在
              Codeville 的个人工作室里。
            </p>
            <a
              class="primarylink"
              :href="href('/explore/?place=ST&hotspot=Frostwick')"
              >进入收藏品特写 →</a
            >
          </div>
          <img :src="pic('collection')" alt="独立作品 Frostwick 的原始渲染" />
        </div>
        <figure class="collect">
          <img :src="pic('globe')" alt="工作室收藏架上的 Frostwick" />
          <figcaption>工作室中的 Frostwick · Codeville 实际模型画面</figcaption>
        </figure>
      </section>
      <template v-else-if="route === '/explore/'">
        <div class="explore-slot" data-runtime-slot>
          <section class="shell explore-cover">
            <div>
              <p class="ey">Explore Codeville</p>
              <h1>探索小镇</h1>
              <p>四栋核心建筑、三个相邻街区与一间可以走进去的工作室。</p>
              <button class="enable" data-enable hidden>启用三维探索 →</button
              ><a class="textlink" href="#directory">浏览地点目录 ↓</a>
            </div>
            <img :src="pic('day-1280')" alt="Codeville 完整日光总览" />
          </section>
        </div>
        <section class="shell block guide" data-static-guide id="directory">
          <p class="ey">Town directory</p>
          <h2>地点与作品</h2>
          <div class="guidegrid">
            <div>
              <h3>建筑</h3>
              <a
                v-for="p in PROJECTS"
                :key="p.id"
                :href="href('/projects/' + p.id + '/')"
                >{{ p.name }} · {{ shorts[p.id] }} ↗</a
              ><a :href="href('/studio/')">Portal · 个人工作室 ↗</a>
            </div>
            <div>
              <h3>中央双环</h3>
              <a
                v-for="c in chapters"
                :key="c.id"
                :href="href('/systems/#' + c.id)"
                >{{ c.title }} ↗</a
              >
            </div>
            <div>
              <h3>街区</h3>
              <a
                v-for="[id, name] in districts"
                :key="id"
                :href="href('/explore/?view=' + id)"
                >{{ name }} →</a
              >
            </div>
          </div>
          <details>
            <summary>查看街区海报与室内热点</summary>
            <div class="projects">
              <figure v-for="[id, name] in districts" :key="id">
                <img :src="pic(id)" :alt="name" loading="lazy" />
                <figcaption>{{ name }}</figcaption>
              </figure>
            </div>
            <div class="spotlinks">
              <a
                v-for="[id, name, desc] in spots"
                :key="id"
                :href="href('/explore/?place=ST&hotspot=' + id)"
                >{{ name }} · {{ desc }}</a
              >
            </div>
          </details>
        </section>
      </template>
      <section v-else class="shell block">
        <p class="ey">404</p>
        <h1>找不到这个页面</h1>
        <a class="primarylink" :href="href('/')">返回作品集 →</a>
      </section>
    </main>
    <footer class="foot">
      <div class="shell">
        <a class="signature" :href="href('/')">简小淼 <em>Studio</em></a
        ><a :href="SITE_PROFILE.githubProfile">GitHub ↗</a>
      </div>
    </footer>
  </div>
</template>
