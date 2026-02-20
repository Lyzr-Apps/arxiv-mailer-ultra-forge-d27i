'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import {
  getSchedule,
  getScheduleLogs,
  pauseSchedule,
  resumeSchedule,
  cronToHuman,
} from '@/lib/scheduler'
import type { Schedule, ExecutionLog } from '@/lib/scheduler'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Label } from '@/components/ui/label'
import {
  HiMagnifyingGlass,
  HiPlus,
  HiXMark,
  HiClock,
  HiEnvelope,
  HiDocumentText,
  HiCog6Tooth,
  HiTrash,
  HiArrowPath,
  HiChevronDown,
  HiChevronRight,
  HiBookOpen,
  HiLightBulb,
  HiCalendarDays,
  HiPaperAirplane,
  HiEye,
  HiPlayCircle,
  HiPauseCircle,
  HiCheck,
  HiExclamationTriangle,
  HiAcademicCap,
  HiBeaker,
  HiArchiveBox,
  HiArrowTopRightOnSquare,
  HiHome,
  HiBars3,
} from 'react-icons/hi2'

// ============================================================================
// Constants
// ============================================================================

const MANAGER_AGENT_ID = '6997b86c249b5b042152423e'
const ARXIV_AGENT_ID = '6997b858c00585daae144d9a'
const EMAIL_AGENT_ID = '6997b859249b5b042152423c'
const SCHEDULE_ID = '6997b872399dfadeac37c0a7'

const LS_TOPICS_KEY = 'arxiv_monitor_topics'
const LS_HISTORY_KEY = 'arxiv_monitor_history'
const LS_SETTINGS_KEY = 'arxiv_monitor_settings'

// ============================================================================
// Types
// ============================================================================

interface ResearchTopic {
  id: string
  name: string
  keywords: string
  addedAt: string
  lastPaperCount?: number
}

interface PaperData {
  title: string
  authors: string
  published_date: string
  arxiv_link: string
  summary: string
  key_insights: string[]
}

interface TopicPapers {
  topic_name: string
  paper_count: number
  papers: PaperData[]
}

interface DigestEntry {
  id: string
  date: string
  status: string
  topicsProcessed: number
  totalPapers: number
  emailStatus: string
  digestPreview: string
  dateRange: string
  papersByTopic: TopicPapers[]
}

interface UserSettings {
  recipientEmail: string
  includeSummaries: boolean
  includeKeyInsights: boolean
  titlesOnly: boolean
}

type NavSection = 'dashboard' | 'history' | 'settings'

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_TOPICS: ResearchTopic[] = [
  { id: 's1', name: 'Large Language Models', keywords: 'LLM, GPT, transformer, language model', addedAt: '2025-02-10T08:00:00Z', lastPaperCount: 12 },
  { id: 's2', name: 'Reinforcement Learning', keywords: 'RL, policy gradient, reward shaping, RLHF', addedAt: '2025-02-12T14:30:00Z', lastPaperCount: 8 },
  { id: 's3', name: 'Computer Vision', keywords: 'image recognition, object detection, segmentation, diffusion models', addedAt: '2025-02-14T10:15:00Z', lastPaperCount: 15 },
  { id: 's4', name: 'Graph Neural Networks', keywords: 'GNN, message passing, node classification, graph transformer', addedAt: '2025-02-15T09:00:00Z', lastPaperCount: 6 },
]

const SAMPLE_DIGEST: DigestEntry = {
  id: 'sample-1',
  date: '2025-02-17T08:00:00Z',
  status: 'completed',
  topicsProcessed: 3,
  totalPapers: 9,
  emailStatus: 'sent',
  digestPreview: 'Weekly ArXiv Research Digest - Feb 17, 2025',
  dateRange: '2025-02-10 to 2025-02-17',
  papersByTopic: [
    {
      topic_name: 'Large Language Models',
      paper_count: 4,
      papers: [
        {
          title: 'Scaling Laws for Neural Language Models Revisited',
          authors: 'J. Smith, A. Johnson, L. Chen',
          published_date: '2025-02-15',
          arxiv_link: 'https://arxiv.org/abs/2502.12345',
          summary: 'This paper revisits scaling laws for language models, proposing updated power-law relationships between compute, data, and model performance. The authors find that previous scaling estimates were overly conservative for models above 100B parameters.',
          key_insights: ['Revised scaling exponents for large models', 'Data quality matters more at scale', 'Compute-optimal training requires 3x more data than Chinchilla suggests'],
        },
        {
          title: 'Efficient Fine-tuning with Sparse Adapters',
          authors: 'M. Wang, K. Lee, R. Patel',
          published_date: '2025-02-14',
          arxiv_link: 'https://arxiv.org/abs/2502.12346',
          summary: 'Introduces a novel sparse adapter architecture that achieves full fine-tuning performance with only 0.1% additional parameters. The method leverages structured sparsity patterns derived from attention head importance scores.',
          key_insights: ['0.1% parameter overhead for full fine-tuning quality', 'Attention-guided sparsity selection', 'Compatible with quantized models'],
        },
        {
          title: 'Constitutional AI: A Framework for Safe Language Models',
          authors: 'D. Brown, S. Martinez',
          published_date: '2025-02-13',
          arxiv_link: 'https://arxiv.org/abs/2502.12347',
          summary: 'Proposes an extended constitutional AI framework incorporating multi-stakeholder value alignment. The approach uses iterative self-critique with diverse constitutional principles to reduce harmful outputs by 87%.',
          key_insights: ['Multi-stakeholder alignment framework', '87% reduction in harmful outputs', 'Minimal performance degradation on benchmarks'],
        },
        {
          title: 'Multimodal Reasoning in Large Language Models',
          authors: 'Y. Zhang, P. Kumar, T. Nakamura',
          published_date: '2025-02-12',
          arxiv_link: 'https://arxiv.org/abs/2502.12348',
          summary: 'Demonstrates that chain-of-thought reasoning can be effectively extended to multimodal inputs including images, diagrams, and tables. The proposed architecture achieves state-of-the-art on visual question answering tasks.',
          key_insights: ['Chain-of-thought extended to multimodal inputs', 'New SOTA on visual QA benchmarks', 'Emergent spatial reasoning capabilities'],
        },
      ],
    },
    {
      topic_name: 'Reinforcement Learning',
      paper_count: 3,
      papers: [
        {
          title: 'Offline RL with Reward-Free Pre-training',
          authors: 'C. Garcia, H. Wilson',
          published_date: '2025-02-15',
          arxiv_link: 'https://arxiv.org/abs/2502.22345',
          summary: 'Proposes a two-phase approach combining unsupervised pre-training with offline RL fine-tuning. The reward-free pre-training phase learns rich state representations that significantly improve downstream task performance.',
          key_insights: ['Reward-free pre-training improves sample efficiency 5x', 'State representations transfer across tasks', 'Works with limited offline data'],
        },
        {
          title: 'Multi-Agent Cooperation through Emergent Communication',
          authors: 'L. Anderson, F. Rossi',
          published_date: '2025-02-14',
          arxiv_link: 'https://arxiv.org/abs/2502.22346',
          summary: 'Studies emergent communication protocols in multi-agent RL settings. Agents develop structured languages with compositional semantics when pressured by cooperative tasks requiring complex coordination.',
          key_insights: ['Emergent compositional language structure', 'Communication bandwidth affects language complexity', 'Cooperative pressure drives semantic richness'],
        },
        {
          title: 'Safe Exploration via Constrained Policy Optimization',
          authors: 'N. Taylor, B. Lopez',
          published_date: '2025-02-13',
          arxiv_link: 'https://arxiv.org/abs/2502.22347',
          summary: 'Introduces constraint-aware exploration strategies that guarantee safety during online learning. The method maintains a learned safety critic that prevents the agent from entering dangerous states.',
          key_insights: ['Zero safety violations during training', 'Learned safety critic generalizes across environments', 'Minimal impact on exploration efficiency'],
        },
      ],
    },
    {
      topic_name: 'Computer Vision',
      paper_count: 2,
      papers: [
        {
          title: 'Video Understanding with Temporal Graph Networks',
          authors: 'R. Huang, E. Davis',
          published_date: '2025-02-15',
          arxiv_link: 'https://arxiv.org/abs/2502.32345',
          summary: 'Presents a temporal graph network architecture for video understanding that models interactions between objects across frames. The approach achieves superior performance on action recognition and video QA tasks.',
          key_insights: ['Graph-based temporal modeling outperforms attention', 'Efficient O(n) complexity per frame', 'Strong performance on long videos'],
        },
        {
          title: 'Diffusion Models for 3D Scene Generation',
          authors: 'A. Kim, J. O\'Brien',
          published_date: '2025-02-14',
          arxiv_link: 'https://arxiv.org/abs/2502.32346',
          summary: 'Extends diffusion models to generate complete 3D scenes from text descriptions. The method combines a scene graph prior with a neural radiance field decoder for high-fidelity scene synthesis.',
          key_insights: ['Text-to-3D scene generation', 'Scene graph prior for spatial consistency', 'Photorealistic rendering quality'],
        },
      ],
    },
  ],
}

const SAMPLE_HISTORY: DigestEntry[] = [
  SAMPLE_DIGEST,
  {
    id: 'sample-2',
    date: '2025-02-10T08:00:00Z',
    status: 'completed',
    topicsProcessed: 2,
    totalPapers: 6,
    emailStatus: 'sent',
    digestPreview: 'Weekly ArXiv Research Digest - Feb 10, 2025',
    dateRange: '2025-02-03 to 2025-02-10',
    papersByTopic: [
      {
        topic_name: 'Large Language Models',
        paper_count: 4,
        papers: [
          { title: 'Attention Is All You Need... Again', authors: 'A. Researcher', published_date: '2025-02-08', arxiv_link: 'https://arxiv.org/abs/2502.00001', summary: 'A comprehensive re-evaluation of attention mechanisms in modern transformer architectures.', key_insights: ['Sparse attention is more efficient', 'Multi-query attention scales better'] },
        ],
      },
      {
        topic_name: 'Reinforcement Learning',
        paper_count: 2,
        papers: [
          { title: 'Model-Based RL for Robotics', authors: 'B. Scientist', published_date: '2025-02-09', arxiv_link: 'https://arxiv.org/abs/2502.00002', summary: 'Applying model-based reinforcement learning techniques to real-world robotic manipulation tasks.', key_insights: ['Sim-to-real transfer improved by 40%', 'World models reduce sample complexity'] },
        ],
      },
    ],
  },
]

// ============================================================================
// Suggested Topics (pre-written with ArXiv-friendly keywords)
// ============================================================================

interface SuggestedTopic {
  name: string
  keywords: string
  category: string
}

const SUGGESTED_TOPICS: SuggestedTopic[] = [
  { name: 'Large Language Models', keywords: 'large language model, LLM, GPT, transformer, instruction tuning, in-context learning', category: 'NLP' },
  { name: 'Reinforcement Learning', keywords: 'reinforcement learning, policy gradient, reward shaping, RLHF, Q-learning, PPO', category: 'ML' },
  { name: 'Computer Vision', keywords: 'computer vision, image recognition, object detection, visual transformer, ViT', category: 'CV' },
  { name: 'Diffusion Models', keywords: 'diffusion model, denoising diffusion, DDPM, score matching, stable diffusion, image generation', category: 'Generative' },
  { name: 'Graph Neural Networks', keywords: 'graph neural network, GNN, message passing, node classification, graph transformer', category: 'ML' },
  { name: 'Multi-Agent Systems', keywords: 'multi-agent, cooperative agents, agent communication, multi-agent reinforcement learning', category: 'AI' },
  { name: 'AI Safety & Alignment', keywords: 'AI safety, alignment, RLHF, constitutional AI, value alignment, safe AI, red teaming', category: 'AI' },
  { name: 'Federated Learning', keywords: 'federated learning, distributed learning, privacy preserving, differential privacy', category: 'ML' },
  { name: 'Natural Language Processing', keywords: 'natural language processing, NLP, text classification, sentiment analysis, named entity recognition, parsing', category: 'NLP' },
  { name: 'Robotics & Control', keywords: 'robotics, robot learning, manipulation, locomotion, sim-to-real, motion planning', category: 'Robotics' },
  { name: 'Speech & Audio', keywords: 'speech recognition, automatic speech recognition, ASR, text-to-speech, TTS, audio processing', category: 'Audio' },
  { name: 'Knowledge Graphs', keywords: 'knowledge graph, knowledge representation, entity relation, knowledge base, link prediction', category: 'NLP' },
  { name: 'Neural Architecture Search', keywords: 'neural architecture search, NAS, AutoML, architecture optimization, efficient neural networks', category: 'ML' },
  { name: 'Quantum Machine Learning', keywords: 'quantum computing, quantum machine learning, quantum algorithm, variational quantum, qubit', category: 'Quantum' },
  { name: 'Medical AI', keywords: 'medical imaging, clinical NLP, drug discovery, biomedical, healthcare AI, radiology AI', category: 'Healthcare' },
  { name: 'Autonomous Driving', keywords: 'autonomous driving, self-driving, lidar, point cloud, trajectory prediction, vehicle detection', category: 'CV' },
  { name: 'Retrieval-Augmented Generation', keywords: 'retrieval augmented generation, RAG, dense retrieval, semantic search, vector database', category: 'NLP' },
  { name: 'Code Generation', keywords: 'code generation, program synthesis, code completion, automated programming, code LLM', category: 'NLP' },
  { name: 'Multimodal Learning', keywords: 'multimodal, vision-language, CLIP, visual question answering, image-text, cross-modal', category: 'ML' },
  { name: 'Time Series & Forecasting', keywords: 'time series, forecasting, temporal, sequence prediction, anomaly detection, temporal modeling', category: 'ML' },
]

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function getNextMonday8AM(): Date {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000)
  const nextMonday = new Date(istNow)
  const daysUntilMonday = (8 - istNow.getDay()) % 7 || 7
  nextMonday.setDate(istNow.getDate() + daysUntilMonday)
  nextMonday.setHours(8, 0, 0, 0)
  if (istNow.getDay() === 1 && istNow.getHours() < 8) {
    nextMonday.setDate(istNow.getDate())
  }
  return new Date(nextMonday.getTime() - istOffset - now.getTimezoneOffset() * 60 * 1000)
}

function formatCountdown(targetDate: Date, now: Date): { days: number; hours: number; minutes: number; seconds: number } {
  const diff = Math.max(0, targetDate.getTime() - now.getTime())
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return { days, hours, minutes, seconds }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return { from: toYMD(weekAgo), to: toYMD(now) }
}

const DATE_RANGE_PRESETS: { label: string; days: number }[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 3 months', days: 90 },
]

// ============================================================================
// Markdown renderer
// ============================================================================

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// ============================================================================
// Glass card wrapper
// ============================================================================

function GlassCard({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <Card
      className={`backdrop-blur-[16px] bg-card/75 border border-white/[0.18] shadow-sm ${className}`}
      onClick={onClick}
    >
      {children}
    </Card>
  )
}

// ============================================================================
// ErrorBoundary
// ============================================================================

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ============================================================================
// Sidebar Navigation
// ============================================================================

function Sidebar({
  activeSection,
  setActiveSection,
  sidebarOpen,
  setSidebarOpen,
}: {
  activeSection: NavSection
  setActiveSection: (s: NavSection) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}) {
  const navItems: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <HiHome className="w-5 h-5" /> },
    { id: 'history', label: 'Digest History', icon: <HiArchiveBox className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <HiCog6Tooth className="w-5 h-5" /> },
  ]

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-64 backdrop-blur-[16px] bg-card/80 border-r border-white/[0.18] shadow-lg transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          <div className="p-5 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <HiAcademicCap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-foreground text-base tracking-tight">ArXiv Monitor</h1>
                <p className="text-[11px] text-muted-foreground">Research Digest System</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id)
                  setSidebarOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeSection === item.id ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-border/50">
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Agents</p>
              <AgentStatusItem name="Research Coordinator" agentId={MANAGER_AGENT_ID} role="Manager" isActive={false} />
              <AgentStatusItem name="ArXiv Researcher" agentId={ARXIV_AGENT_ID} role="Sub-agent" isActive={false} />
              <AgentStatusItem name="Email Composer" agentId={EMAIL_AGENT_ID} role="Sub-agent" isActive={false} />
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function AgentStatusItem({ name, agentId, role, isActive }: { name: string; agentId: string; role: string; isActive: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
      <div className="min-w-0">
        <p className="text-xs text-foreground truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground">{role}</p>
      </div>
    </div>
  )
}

// ============================================================================
// Topic Card
// ============================================================================

function TopicCard({ topic, onRemove }: { topic: ResearchTopic; onRemove: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <GlassCard className="group hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <HiBeaker className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm text-foreground truncate">{topic.name}</h3>
          </div>
          {confirmDelete ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => onRemove(topic.id)}>
                <HiCheck className="w-3 h-3 mr-1" />
                Yes
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmDelete(false)}>
                No
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <HiTrash className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {topic.keywords.split(',').map((kw, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
              {kw.trim()}
            </Badge>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Added {formatDate(topic.addedAt)}</span>
          {(topic.lastPaperCount ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              <HiDocumentText className="w-3 h-3 mr-1" />
              {topic.lastPaperCount} papers
            </Badge>
          )}
        </div>
      </CardContent>
    </GlassCard>
  )
}

// ============================================================================
// Paper Card
// ============================================================================

function PaperCard({ paper }: { paper: PaperData }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <GlassCard className="hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <HiDocumentText className="w-4 h-4 text-accent-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-sm text-foreground leading-snug">{paper?.title ?? 'Untitled'}</h4>
              {paper?.arxiv_link && (
                <a
                  href={paper.arxiv_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
                >
                  <HiArrowTopRightOnSquare className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {paper?.authors ?? 'Unknown authors'} {paper?.published_date ? `| ${formatDate(paper.published_date)}` : ''}
            </p>
            {paper?.summary && (
              <div className="mt-2">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {expanded ? <HiChevronDown className="w-3 h-3" /> : <HiChevronRight className="w-3 h-3" />}
                  {expanded ? 'Hide summary' : 'Show summary'}
                </button>
                {expanded && (
                  <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {renderMarkdown(paper.summary)}
                  </div>
                )}
              </div>
            )}
            {Array.isArray(paper?.key_insights) && paper.key_insights.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {paper.key_insights.map((insight, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-normal px-2 py-0.5 bg-amber-50/50 border-amber-200/50 text-amber-700">
                    <HiLightBulb className="w-3 h-3 mr-1 text-amber-500" />
                    {insight}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </GlassCard>
  )
}

// ============================================================================
// Countdown Component
// ============================================================================

function CountdownDisplay() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!now) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  const target = getNextMonday8AM()
  const { days, hours, minutes, seconds } = formatCountdown(target, now)

  const units = [
    { val: days, label: 'Days' },
    { val: hours, label: 'Hours' },
    { val: minutes, label: 'Min' },
    { val: seconds, label: 'Sec' },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {units.map((u) => (
        <div key={u.label} className="text-center">
          <div className="bg-primary/10 rounded-xl py-2.5 px-2">
            <span className="text-2xl font-bold text-primary tabular-nums">{String(u.val).padStart(2, '0')}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 font-medium">{u.label}</p>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Add Topic Dialog
// ============================================================================

function AddTopicDialog({ onAdd }: { onAdd: (name: string, keywords: string) => void }) {
  const [topicName, setTopicName] = useState('')
  const [topicKeywords, setTopicKeywords] = useState('')
  const [open, setOpen] = useState(false)

  const handleAdd = () => {
    if (topicName.trim()) {
      onAdd(topicName.trim(), topicKeywords.trim())
      setTopicName('')
      setTopicKeywords('')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 shadow-sm">
          <HiPlus className="w-4 h-4" />
          Add Topic
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md backdrop-blur-[16px] bg-card/95 border border-white/[0.18]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HiBeaker className="w-5 h-5 text-primary" />
            Add Research Topic
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="topic-name" className="text-sm">Topic Name *</Label>
            <Input
              id="topic-name"
              placeholder="e.g., Large Language Models"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic-keywords" className="text-sm">Keywords (comma-separated)</Label>
            <Input
              id="topic-keywords"
              placeholder="e.g., LLM, GPT, transformer"
              value={topicKeywords}
              onChange={(e) => setTopicKeywords(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            />
            <p className="text-[11px] text-muted-foreground">These keywords help narrow down the arXiv search results.</p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </DialogClose>
          <Button size="sm" onClick={handleAdd} disabled={!topicName.trim()}>
            <HiPlus className="w-4 h-4 mr-1" />
            Add Topic
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Dashboard Section
// ============================================================================

// ============================================================================
// Suggested Topics Section
// ============================================================================

function SuggestedTopicsSection({
  existingTopics,
  onAddTopic,
}: {
  existingTopics: ResearchTopic[]
  onAddTopic: (name: string, keywords: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const existingNames = useMemo(
    () => new Set(existingTopics.map((t) => t.name.toLowerCase())),
    [existingTopics]
  )

  const categories = useMemo(() => {
    const cats = new Set(SUGGESTED_TOPICS.map((t) => t.category))
    return Array.from(cats).sort()
  }, [])

  const filteredSuggestions = useMemo(() => {
    let topics = SUGGESTED_TOPICS.filter((t) => !existingNames.has(t.name.toLowerCase()))
    if (selectedCategory) {
      topics = topics.filter((t) => t.category === selectedCategory)
    }
    return topics
  }, [existingNames, selectedCategory])

  const displayedSuggestions = expanded ? filteredSuggestions : filteredSuggestions.slice(0, 6)

  if (filteredSuggestions.length === 0 && !selectedCategory) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiLightBulb className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground">Suggested Topics</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">{filteredSuggestions.length} available</span>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${!selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-muted-foreground hover:bg-secondary'}`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-muted-foreground hover:bg-secondary'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Topic Chips */}
      <div className="flex flex-wrap gap-1.5">
        {displayedSuggestions.map((topic) => (
          <button
            key={topic.name}
            onClick={() => onAddTopic(topic.name, topic.keywords)}
            className="group inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/50 hover:bg-primary/10 border border-transparent hover:border-primary/20 text-xs text-foreground transition-all duration-200"
            title={`Keywords: ${topic.keywords}`}
          >
            <HiPlus className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
            <span>{topic.name}</span>
            <Badge variant="outline" className="text-[8px] px-1 py-0 ml-0.5 border-muted-foreground/30">
              {topic.category}
            </Badge>
          </button>
        ))}
      </div>

      {/* Show more / less */}
      {filteredSuggestions.length > 6 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          {expanded ? (
            <>
              <HiChevronDown className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <HiChevronRight className="w-3 h-3" />
              Show all {filteredSuggestions.length} topics
            </>
          )}
        </button>
      )}

      <p className="text-[10px] text-muted-foreground">
        Click a topic to add it with pre-configured ArXiv search keywords.
      </p>
    </div>
  )
}

// ============================================================================
// Dashboard Section
// ============================================================================

function DashboardSection({
  topics,
  onAddTopic,
  onRemoveTopic,
  settings,
  sampleMode,
  onDigestGenerated,
  activeAgentId,
  setActiveAgentId,
}: {
  topics: ResearchTopic[]
  onAddTopic: (name: string, keywords: string) => void
  onRemoveTopic: (id: string) => void
  settings: UserSettings
  sampleMode: boolean
  onDigestGenerated: (entry: DigestEntry) => void
  activeAgentId: string | null
  setActiveAgentId: (id: string | null) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [digestData, setDigestData] = useState<DigestEntry | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Date range state
  const defaults = useMemo(() => getDefaultDateRange(), [])
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)

  const displayTopics = sampleMode ? SAMPLE_TOPICS : topics
  const displayDigest = sampleMode ? SAMPLE_DIGEST : digestData

  const applyPreset = (days: number) => {
    const now = new Date()
    const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    setDateFrom(toYMD(past))
    setDateTo(toYMD(now))
  }

  const handleFetchAndSend = async () => {
    if (displayTopics.length === 0) {
      setError('Add at least one research topic first.')
      return
    }
    if (!settings.recipientEmail) {
      setError('Please set a recipient email in Settings first.')
      return
    }
    if (!dateFrom || !dateTo) {
      setError('Please select both a start and end date.')
      return
    }
    if (new Date(dateFrom) > new Date(dateTo)) {
      setError('Start date cannot be after end date.')
      return
    }
    setLoading(true)
    setError(null)
    setDigestData(null)
    setStatusMessage(null)
    setActiveAgentId(MANAGER_AGENT_ID)

    try {
      const message = JSON.stringify({
        topics: displayTopics.map((t) => ({
          name: t.name,
          keywords: t.keywords,
        })),
        recipient_email: settings.recipientEmail,
        date_from: dateFrom,
        date_to: dateTo,
        include_summaries: settings.includeSummaries,
        include_key_insights: settings.includeKeyInsights,
      })

      const result = await callAIAgent(message, MANAGER_AGENT_ID)

      if (result.success && result?.response?.result) {
        const data = result.response.result
        const papersByTopic = Array.isArray(data?.papers_by_topic) ? data.papers_by_topic : []

        const entry: DigestEntry = {
          id: generateId(),
          date: new Date().toISOString(),
          status: data?.status ?? 'completed',
          topicsProcessed: data?.topics_processed ?? 0,
          totalPapers: data?.total_papers ?? 0,
          emailStatus: data?.email_status ?? 'sent',
          digestPreview: data?.digest_preview ?? '',
          dateRange: (data?.date_range as string) ?? `${dateFrom} to ${dateTo}`,
          papersByTopic: papersByTopic.map((t: Record<string, unknown>) => ({
            topic_name: (t?.topic_name as string) ?? 'Unknown Topic',
            paper_count: (t?.paper_count as number) ?? 0,
            papers: Array.isArray(t?.papers)
              ? (t.papers as Record<string, unknown>[]).map((p) => ({
                  title: (p?.title as string) ?? '',
                  authors: (p?.authors as string) ?? '',
                  published_date: (p?.published_date as string) ?? '',
                  arxiv_link: (p?.arxiv_link as string) ?? '',
                  summary: (p?.summary as string) ?? '',
                  key_insights: Array.isArray(p?.key_insights) ? (p.key_insights as string[]) : [],
                }))
              : [],
          })),
        }

        onDigestGenerated(entry)
        setDigestData(entry)
        setStatusMessage(`Digest sent to ${settings.recipientEmail} -- ${entry.totalPapers} papers across ${entry.topicsProcessed} topics (${dateFrom} to ${dateTo})`)
      } else {
        setError(result?.error ?? result?.response?.message ?? 'Failed to fetch and send digest. Please try again.')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left Column - Topics */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">Research Topics</h2>
            <Badge variant="secondary" className="text-xs">{displayTopics.length}</Badge>
          </div>
          {!sampleMode && <AddTopicDialog onAdd={onAddTopic} />}
        </div>

        {displayTopics.length === 0 ? (
          <GlassCard>
            <CardContent className="py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <HiBeaker className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No topics yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Add a research topic or pick from the suggestions below to start monitoring arXiv papers.</p>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <span>Use</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  <HiPlus className="w-3 h-3 mr-0.5" /> Add Topic
                </Badge>
                <span>or pick a suggested topic below</span>
              </div>
            </CardContent>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
            {displayTopics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} onRemove={onRemoveTopic} />
            ))}
          </div>
        )}

        {/* Suggested Topics */}
        {!sampleMode && (
          <SuggestedTopicsSection
            existingTopics={topics}
            onAddTopic={onAddTopic}
          />
        )}
      </div>

      {/* Right Column - Actions + Results */}
      <div className="lg:col-span-3 space-y-4">
        {/* Countdown */}
        <GlassCard>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <HiClock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Next Scheduled Digest</h3>
                <p className="text-[11px] text-muted-foreground">Every Monday at 8:00 AM IST</p>
              </div>
            </div>
            <CountdownDisplay />
          </CardContent>
        </GlassCard>

        {/* Date Range Selection + Trigger */}
        <GlassCard>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <HiCalendarDays className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Paper Date Range</h3>
                <p className="text-[11px] text-muted-foreground">Select the date window for ArXiv paper search</p>
              </div>
            </div>

            {/* Preset Buttons */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {DATE_RANGE_PRESETS.map((preset) => {
                const presetTo = new Date()
                const presetFrom = new Date(presetTo.getTime() - preset.days * 24 * 60 * 60 * 1000)
                const isActive = dateFrom === toYMD(presetFrom) && dateTo === toYMD(presetTo)
                return (
                  <button
                    key={preset.days}
                    onClick={() => applyPreset(preset.days)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary/60 text-secondary-foreground hover:bg-secondary'}`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            {/* Custom Date Inputs */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="space-y-1.5">
                <Label htmlFor="date-from" className="text-xs text-muted-foreground">From</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date-to" className="text-xs text-muted-foreground">To</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-sm h-9"
                />
              </div>
            </div>

            {/* Selected range display */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/30 mb-4">
              <HiCalendarDays className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">
                Searching papers from <span className="font-medium text-foreground">{formatDate(dateFrom)}</span> to <span className="font-medium text-foreground">{formatDate(dateTo)}</span>
              </span>
            </div>

            {/* Action Button */}
            <Button
              className="w-full gap-2 shadow-sm h-10"
              onClick={handleFetchAndSend}
              disabled={loading || displayTopics.length === 0}
            >
              {loading ? (
                <HiArrowPath className="w-4 h-4 animate-spin" />
              ) : (
                <HiPaperAirplane className="w-4 h-4" />
              )}
              {loading ? 'Searching ArXiv & sending email...' : 'Fetch Papers & Send Digest'}
            </Button>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              This will search ArXiv for papers in the selected date range and send the digest email to {settings.recipientEmail || '(no email set)'}
            </p>
          </CardContent>
        </GlassCard>

        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <HiExclamationTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-destructive" onClick={() => setError(null)}>
              <HiXMark className="w-4 h-4" />
            </Button>
          </div>
        )}
        {statusMessage && !error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200/50 text-green-700 text-sm">
            <HiCheck className="w-4 h-4 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <GlassCard>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <HiArrowPath className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">Fetching papers from ArXiv and composing email...</p>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Separator />
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
              ))}
            </CardContent>
          </GlassCard>
        )}

        {/* Digest Results */}
        {displayDigest && !loading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-foreground">Digest Results</h3>
              <div className="flex items-center gap-2">
                {displayDigest.dateRange && (
                  <Badge variant="outline" className="text-[10px]">
                    <HiCalendarDays className="w-3 h-3 mr-1" />
                    {displayDigest.dateRange}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  <HiDocumentText className="w-3 h-3 mr-1" />
                  {displayDigest.totalPapers} papers
                </Badge>
                <Badge variant="default" className="text-xs">
                  <HiEnvelope className="w-3 h-3 mr-1" />
                  {displayDigest.emailStatus}
                </Badge>
              </div>
            </div>

            {displayDigest.digestPreview && (
              <GlassCard>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">{renderMarkdown(displayDigest.digestPreview)}</div>
                </CardContent>
              </GlassCard>
            )}

            {Array.isArray(displayDigest.papersByTopic) &&
              displayDigest.papersByTopic.map((topicGroup, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="text-xs px-2.5 py-0.5">{topicGroup?.topic_name ?? 'Unknown'}</Badge>
                    <span className="text-xs text-muted-foreground">{topicGroup?.paper_count ?? 0} papers</span>
                  </div>
                  {Array.isArray(topicGroup?.papers) &&
                    topicGroup.papers.map((paper, pidx) => (
                      <PaperCard key={pidx} paper={paper} />
                    ))}
                </div>
              ))}
          </div>
        )}

        {/* Empty state */}
        {!displayDigest && !loading && (
          <GlassCard>
            <CardContent className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <HiBookOpen className="w-7 h-7 text-accent-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No digest yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Select a date range and click "Fetch Papers & Send Digest" to search ArXiv and receive your digest email.
              </p>
            </CardContent>
          </GlassCard>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Digest History Section
// ============================================================================

function DigestHistorySection({
  history,
  sampleMode,
}: {
  history: DigestEntry[]
  sampleMode: boolean
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const displayHistory = sampleMode ? SAMPLE_HISTORY : history

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return displayHistory
    const q = searchQuery.toLowerCase()
    return displayHistory.filter((entry) => {
      const topicNames = Array.isArray(entry?.papersByTopic)
        ? entry.papersByTopic.map((t) => t?.topic_name ?? '').join(' ')
        : ''
      return (
        (entry?.digestPreview ?? '').toLowerCase().includes(q) ||
        topicNames.toLowerCase().includes(q) ||
        formatDate(entry?.date ?? '').toLowerCase().includes(q)
      )
    })
  }, [displayHistory, searchQuery])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Digest History</h2>
        <Badge variant="secondary" className="text-xs">{displayHistory.length} digests</Badge>
      </div>

      <div className="relative">
        <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search digests..."
          className="pl-9 bg-card/50 border-border/50"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredHistory.length === 0 ? (
        <GlassCard>
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <HiArchiveBox className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {searchQuery ? 'No results found' : 'No digest history'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? 'Try different search terms.'
                : 'Generate your first digest to see it here.'}
            </p>
          </CardContent>
        </GlassCard>
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {filteredHistory.map((entry) => (
            <AccordionItem key={entry.id} value={entry.id} className="border-0">
              <GlassCard>
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-4 text-left w-full mr-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <HiCalendarDays className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground">{formatDate(entry?.date ?? '')}</p>
                      <p className="text-xs text-muted-foreground truncate">{entry?.digestPreview ?? 'Research digest'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {entry?.dateRange && (
                        <Badge variant="outline" className="text-[10px]">
                          <HiCalendarDays className="w-3 h-3 mr-0.5" />
                          {entry.dateRange}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {entry?.topicsProcessed ?? 0} topics
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {entry?.totalPapers ?? 0} papers
                      </Badge>
                      <Badge
                        variant={entry?.emailStatus === 'sent' ? 'default' : 'outline'}
                        className="text-[10px]"
                      >
                        <HiEnvelope className="w-3 h-3 mr-0.5" />
                        {entry?.emailStatus ?? 'unknown'}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <Separator className="mb-3" />
                  {Array.isArray(entry?.papersByTopic) && entry.papersByTopic.length > 0 ? (
                    <div className="space-y-4">
                      {entry.papersByTopic.map((topicGroup, tIdx) => (
                        <div key={tIdx} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className="text-xs">{topicGroup?.topic_name ?? 'Unknown'}</Badge>
                            <span className="text-xs text-muted-foreground">{topicGroup?.paper_count ?? 0} papers</span>
                          </div>
                          {Array.isArray(topicGroup?.papers) &&
                            topicGroup.papers.map((paper, pIdx) => (
                              <PaperCard key={pIdx} paper={paper} />
                            ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No paper details available for this digest.</p>
                  )}
                </AccordionContent>
              </GlassCard>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  )
}

// ============================================================================
// Settings Section
// ============================================================================

function SettingsSection({
  settings,
  onUpdateSettings,
}: {
  settings: UserSettings
  onUpdateSettings: (updates: Partial<UserSettings>) => void
}) {
  const [scheduleData, setScheduleData] = useState<Schedule | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [toggleMsg, setToggleMsg] = useState<string | null>(null)

  const loadScheduleData = useCallback(async () => {
    setScheduleLoading(true)
    setScheduleError(null)
    try {
      const result = await getSchedule(SCHEDULE_ID)
      if (result.success && result.schedule) {
        setScheduleData(result.schedule)
      } else {
        setScheduleError(result.error ?? 'Failed to load schedule')
      }
    } catch {
      setScheduleError('Failed to load schedule data')
    }
    setScheduleLoading(false)
  }, [])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const result = await getScheduleLogs(SCHEDULE_ID, { limit: 5 })
      if (result.success) {
        setLogs(Array.isArray(result.executions) ? result.executions : [])
      }
    } catch {
      // silently fail
    }
    setLogsLoading(false)
  }, [])

  useEffect(() => {
    loadScheduleData()
    loadLogs()
  }, [loadScheduleData, loadLogs])

  const handleToggleSchedule = async () => {
    if (!scheduleData) return
    setToggling(true)
    setToggleMsg(null)
    setScheduleError(null)

    try {
      if (scheduleData.is_active) {
        const result = await pauseSchedule(SCHEDULE_ID)
        if (result.success) {
          setToggleMsg('Schedule paused successfully')
        } else {
          setScheduleError(result.error ?? 'Failed to pause schedule')
        }
      } else {
        const result = await resumeSchedule(SCHEDULE_ID)
        if (result.success) {
          setToggleMsg('Schedule resumed successfully')
        } else {
          setScheduleError(result.error ?? 'Failed to resume schedule')
        }
      }
      // Always refresh after toggle
      await loadScheduleData()
    } catch {
      setScheduleError('Failed to toggle schedule')
    }
    setToggling(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-bold text-foreground">Settings</h2>

      {/* Email Configuration */}
      <GlassCard>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <HiEnvelope className="w-4 h-4 text-primary" />
            Email Configuration
          </CardTitle>
          <CardDescription className="text-xs">Where to send the weekly research digest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="recipient-email" className="text-sm">Recipient Email</Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="researcher@university.edu"
              value={settings.recipientEmail}
              onChange={(e) => onUpdateSettings({ recipientEmail: e.target.value })}
            />
          </div>
        </CardContent>
      </GlassCard>

      {/* Digest Format */}
      <GlassCard>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <HiDocumentText className="w-4 h-4 text-primary" />
            Digest Format
          </CardTitle>
          <CardDescription className="text-xs">Customize what appears in your digest emails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Include Summaries</Label>
              <p className="text-[11px] text-muted-foreground">Show paper summaries in the digest</p>
            </div>
            <Switch
              checked={settings.includeSummaries}
              onCheckedChange={(checked) => onUpdateSettings({ includeSummaries: checked })}
              disabled={settings.titlesOnly}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Include Key Insights</Label>
              <p className="text-[11px] text-muted-foreground">Show key insight badges for each paper</p>
            </div>
            <Switch
              checked={settings.includeKeyInsights}
              onCheckedChange={(checked) => onUpdateSettings({ includeKeyInsights: checked })}
              disabled={settings.titlesOnly}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Titles Only Mode</Label>
              <p className="text-[11px] text-muted-foreground">Only show paper titles (disables summaries and insights)</p>
            </div>
            <Switch
              checked={settings.titlesOnly}
              onCheckedChange={(checked) => {
                if (checked) {
                  onUpdateSettings({ titlesOnly: true, includeSummaries: false, includeKeyInsights: false })
                } else {
                  onUpdateSettings({ titlesOnly: false, includeSummaries: true, includeKeyInsights: true })
                }
              }}
            />
          </div>
        </CardContent>
      </GlassCard>

      {/* Schedule Management */}
      <GlassCard>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <HiClock className="w-4 h-4 text-primary" />
            Schedule Management
          </CardTitle>
          <CardDescription className="text-xs">Manage the weekly digest delivery schedule.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheduleLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : scheduleError && !scheduleData ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <HiExclamationTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{scheduleError}</span>
              <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={loadScheduleData}>
                <HiArrowPath className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <>
              {/* Schedule Info */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${scheduleData?.is_active ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {scheduleData?.cron_expression ? cronToHuman(scheduleData.cron_expression) : 'Every Monday at 8:00'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Timezone: {scheduleData?.timezone ?? 'Asia/Kolkata'}
                    </p>
                  </div>
                </div>
                <Badge variant={scheduleData?.is_active ? 'default' : 'secondary'} className="text-xs">
                  {scheduleData?.is_active ? 'Active' : 'Paused'}
                </Badge>
              </div>

              {/* Next Run / Last Run */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-secondary/30">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Next Run</p>
                  <p className="text-xs font-medium text-foreground">
                    {scheduleData?.next_run_time ? formatDateTime(scheduleData.next_run_time) : 'Not scheduled'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/30">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Last Run</p>
                  <p className="text-xs font-medium text-foreground">
                    {scheduleData?.last_run_at ? formatDateTime(scheduleData.last_run_at) : 'Never'}
                  </p>
                </div>
              </div>

              {/* Toggle Button */}
              <div className="flex items-center gap-2">
                <Button
                  variant={scheduleData?.is_active ? 'outline' : 'default'}
                  size="sm"
                  className="gap-1.5"
                  onClick={handleToggleSchedule}
                  disabled={toggling}
                >
                  {toggling ? (
                    <HiArrowPath className="w-4 h-4 animate-spin" />
                  ) : scheduleData?.is_active ? (
                    <HiPauseCircle className="w-4 h-4" />
                  ) : (
                    <HiPlayCircle className="w-4 h-4" />
                  )}
                  {toggling ? 'Processing...' : scheduleData?.is_active ? 'Pause Schedule' : 'Resume Schedule'}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => { loadScheduleData(); loadLogs() }}>
                  <HiArrowPath className="w-3 h-3" />
                  Refresh
                </Button>
              </div>

              {/* Status messages */}
              {scheduleError && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <HiExclamationTriangle className="w-3 h-3" />
                  <span>{scheduleError}</span>
                </div>
              )}
              {toggleMsg && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-green-50 border border-green-200/50 text-green-700 text-xs">
                  <HiCheck className="w-3 h-3" />
                  <span>{toggleMsg}</span>
                </div>
              )}

              {/* Execution History */}
              <Separator />
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Recent Executions</p>
                {logsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">No execution history available.</p>
                ) : (
                  <div className="space-y-1.5">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {log.success ? (
                            <HiCheck className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                          ) : (
                            <HiExclamationTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                          )}
                          <span className="text-muted-foreground">{formatDateTime(log?.executed_at ?? '')}</span>
                        </div>
                        <Badge variant={log.success ? 'secondary' : 'destructive'} className="text-[10px]">
                          {log.success ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </GlassCard>
    </div>
  )
}

// ============================================================================
// Main Page
// ============================================================================

export default function Page() {
  // Navigation
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sampleMode, setSampleMode] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Topics
  const [topics, setTopics] = useState<ResearchTopic[]>([])

  // Digest History
  const [history, setHistory] = useState<DigestEntry[]>([])

  // Settings
  const [settings, setSettings] = useState<UserSettings>({
    recipientEmail: '',
    includeSummaries: true,
    includeKeyInsights: true,
    titlesOnly: false,
  })

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedTopics = localStorage.getItem(LS_TOPICS_KEY)
      if (storedTopics) {
        const parsed = JSON.parse(storedTopics)
        if (Array.isArray(parsed)) setTopics(parsed)
      }
    } catch {}

    try {
      const storedHistory = localStorage.getItem(LS_HISTORY_KEY)
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory)
        if (Array.isArray(parsed)) setHistory(parsed)
      }
    } catch {}

    try {
      const storedSettings = localStorage.getItem(LS_SETTINGS_KEY)
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings)
        if (parsed && typeof parsed === 'object') {
          setSettings((prev) => ({ ...prev, ...parsed }))
        }
      }
    } catch {}
  }, [])

  // Save topics
  useEffect(() => {
    try {
      localStorage.setItem(LS_TOPICS_KEY, JSON.stringify(topics))
    } catch {}
  }, [topics])

  // Save history
  useEffect(() => {
    try {
      localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(history))
    } catch {}
  }, [history])

  // Save settings
  useEffect(() => {
    try {
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings))
    } catch {}
  }, [settings])

  // Handlers
  const handleAddTopic = useCallback((name: string, keywords: string) => {
    const newTopic: ResearchTopic = {
      id: generateId(),
      name,
      keywords: keywords || name,
      addedAt: new Date().toISOString(),
    }
    setTopics((prev) => [...prev, newTopic])
  }, [])

  const handleRemoveTopic = useCallback((id: string) => {
    setTopics((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const handleDigestGenerated = useCallback((entry: DigestEntry) => {
    setHistory((prev) => [entry, ...prev])
  }, [])

  const handleUpdateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground" style={{ background: 'linear-gradient(135deg, hsl(220 30% 97%) 0%, hsl(210 25% 95%) 35%, hsl(200 20% 96%) 70%, hsl(230 25% 97%) 100%)' }}>
        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Main Content */}
        <main className="lg:pl-64 min-h-screen">
          {/* Top Bar */}
          <header className="sticky top-0 z-20 backdrop-blur-[16px] bg-background/70 border-b border-border/50">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3">
              <div className="flex items-center gap-3">
                <button
                  className="lg:hidden p-2 rounded-lg hover:bg-secondary/60 transition-colors"
                  onClick={() => setSidebarOpen(true)}
                >
                  <HiBars3 className="w-5 h-5 text-foreground" />
                </button>
                <div>
                  <h2 className="font-bold text-foreground text-base">
                    {activeSection === 'dashboard' && 'Dashboard'}
                    {activeSection === 'history' && 'Digest History'}
                    {activeSection === 'settings' && 'Settings'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {activeSection === 'dashboard' && 'Monitor and preview your research digests'}
                    {activeSection === 'history' && 'View past digest deliveries'}
                    {activeSection === 'settings' && 'Configure email, format, and schedule'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {activeAgentId && (
                  <Badge variant="outline" className="text-xs gap-1 animate-pulse">
                    <HiArrowPath className="w-3 h-3 animate-spin" />
                    Agent processing
                  </Badge>
                )}
                <div className="flex items-center gap-2">
                  <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">Sample Data</Label>
                  <Switch
                    id="sample-toggle"
                    checked={sampleMode}
                    onCheckedChange={setSampleMode}
                  />
                </div>
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="p-4 sm:p-6">
            {activeSection === 'dashboard' && (
              <DashboardSection
                topics={topics}
                onAddTopic={handleAddTopic}
                onRemoveTopic={handleRemoveTopic}
                settings={settings}
                sampleMode={sampleMode}
                onDigestGenerated={handleDigestGenerated}
                activeAgentId={activeAgentId}
                setActiveAgentId={setActiveAgentId}
              />
            )}
            {activeSection === 'history' && (
              <DigestHistorySection history={history} sampleMode={sampleMode} />
            )}
            {activeSection === 'settings' && (
              <SettingsSection settings={settings} onUpdateSettings={handleUpdateSettings} />
            )}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
