'use client'

import { format } from 'date-fns'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleHelpIcon,
  ExternalLinkIcon,
  FileText,
  ImageIcon,
  Image as ImageIconLucide,
  ImageUp,
  LayersIcon,
  Loader2Icon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SendHorizontal,
  SparkleIcon,
  SquarePenIcon,
  Trash2Icon,
  XIcon,
  ZapIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
// import { useUser } from '@/stores/useUser' // Removido
import EventIconImage from '@/components/EventIconImage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Link, useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

function createOption(id: string) {
  return {
    id,
    title: '',
    question: '',
    slug: '',
    outcomeYes: 'Sim',
    outcomeNo: 'Não',
  }
}

function createInitialForm(overrides: any = {}) {
  return {
    title: overrides.title || '',
    slug: overrides.slug || '',
    endDateIso: overrides.endDateIso || '',
    mainCategorySlug: overrides.mainCategorySlug || '',
    image_url: overrides.image_url || '',
    categories: overrides.categories || [],
    marketMode: overrides.marketMode || 'binary',
    binaryOutcomeYes: overrides.binaryOutcomeYes || 'Sim',
    binaryOutcomeNo: overrides.binaryOutcomeNo || 'Não',
    options: overrides.options || [createOption('opt-1'), createOption('opt-2')],
    resolutionSource: overrides.resolutionSource || '',
    resolutionRules: overrides.resolutionRules || '',
    marketType: overrides.marketType || 'clob',
  }
}

const TOTAL_STEPS = 4

export default function AdminCreateEventForm({
  initialData,
  serverAssetPayload,
}: {
  initialData?: any
  serverAssetPayload?: any
  // Props extras passadas pela page (ignoradas nesta implementação simplificada)
  sportsSlugCatalog?: any
  creationMode?: string
  hasConfiguredServerSigners?: boolean
  initialDraftRecord?: any
  draftId?: string | null
  initialTitle?: string
  initialSlug?: string
  initialEndDateIso?: string
  allowPastResolutionDate?: boolean
  serverDraftPayload?: any
}) {
  const router = useRouter()
  // const { user } = useUser() // Removido por não estar sendo usado e causar erro de lint

  // Estados do Formulário
  const [currentStep, setCurrentStep] = useState(1)
  const [maxVisitedStep, setMaxVisitedStep] = useState(1)
  const [form, setForm] = useState(() => createInitialForm(initialData))
  const [mainCategories, setMainCategories] = useState<any[]>([])
  const [categoryQuery, setCategoryQuery] = useState('')

  // Novos estados PIX
  const [autoResolve, setAutoResolve] = useState(true)
  const [publishImmediately, setPublishImmediately] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [publishDone, setPublishDone] = useState(false)
  const [publishError, setPublishError] = useState('')

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Diálogos
  const [resetFormDialogOpen, setResetFormDialogOpen] = useState(false)

  // Carregar Categorias
  useEffect(() => {
    fetch('/admin/api/main-tags')
      .then(res => res.json())
      .then((data) => {
        // Ajuste para bater com o retorno da API (/admin/api/main-tags/route.ts)
        if (data && data.mainCategories) {
          setMainCategories(data.mainCategories)
        }
      })
      .catch(err => console.error('Failed to load categories', err))
  }, [])

  // Helpers
  const handleFieldChange = useCallback((field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) { return }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const res = await fetch('/admin/api/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      if (data.url) {
        handleFieldChange('image_url', data.url)
        toast.success('Imagem enviada com sucesso!')
      }
      else {
        throw new Error(data.error || 'Erro no upload')
      }
    }
    catch (err: any) {
      toast.error(`Erro ao enviar imagem: ${err.message}`)
    }
    finally {
      setIsUploading(false)
    }
  }, [handleFieldChange])

  const goBack = useCallback(() => {
    setCurrentStep(prev => Math.max(1, prev - 1))
  }, [])

  const isStepValid = useCallback((step: number) => {
    if (step === 1) { return !!form.title && !!form.slug && !!form.endDateIso }
    if (step === 2) { return !!form.marketMode }
    if (step === 3) { return !!form.resolutionRules }
    return true
  }, [form])

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      if (!isStepValid(currentStep)) {
        toast.error('Preencha os campos obrigatórios para continuar.')
        return
      }
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      setMaxVisitedStep(prev => Math.max(prev, nextStep))
    }
    else {
      void publishMarket()
    }
  }, [currentStep, isStepValid])

  const buildPublishPayload = useCallback(() => {
    return {
      event: {
        title: form.title,
        slug: form.slug,
        endDate: form.endDateIso,
        mainCategory: form.mainCategorySlug,
        resolutionSource: form.resolutionSource,
        resolutionRules: form.resolutionRules,
        autoResolve,
        publishStatus: publishImmediately ? 'published' : 'draft',
        image_url: form.image_url,
        marketType: form.marketType,
      },
      markets: form.marketMode === 'binary'
        ? [{
            title: form.title,
            question: form.title,
            outcomes: [form.binaryOutcomeYes, form.binaryOutcomeNo],
            slug: form.slug,
          }]
        : form.options.map((opt: any) => ({
            title: opt.title,
            question: opt.question,
            outcomes: [opt.outcomeYes, opt.outcomeNo],
            slug: opt.slug || `${form.slug}-${opt.title.toLowerCase().replace(/\s+/g, '-')}`,
          })),
    }
  }, [form, autoResolve, publishImmediately])

  const publishMarket = useCallback(async () => {
    setIsPublishing(true)
    setPublishError('')
    try {
      const payload = buildPublishPayload()
      const response = await fetch('/admin/api/publish-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to publish market')
      }

      setPublishDone(true)
      toast.success(publishImmediately ? 'Mercado publicado!' : 'Rascunho salvo!')

      // Redirecionar após 2.5 segundos
      setTimeout(() => {
        router.push('/admin/events/calendar')
      }, 2500)
    }
    catch (error: any) {
      setPublishError(error.message)
      toast.error(error.message)
    }
    finally {
      setIsPublishing(false)
    }
  }, [buildPublishPayload, publishImmediately, router])

  const stepLabels = ['Geral', 'Estrutura', 'Resolução', 'Publicar']

  const handleStepClick = (step: number) => {
    if (step <= maxVisitedStep) {
      setCurrentStep(step)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <form onSubmit={e => e.preventDefault()}>
        {/* STEPS INDICATOR */}
        <Card className="mb-6 bg-background">
          <CardContent className="py-4">
            <div className="grid grid-cols-4 gap-2">
              {stepLabels.map((label, index) => {
                const step = index + 1
                const active = currentStep === step
                const clickable = step <= maxVisitedStep
                return (
                  <button
                    type="button"
                    key={label}
                    onClick={() => handleStepClick(step)}
                    disabled={!clickable}
                    className={cn(
                      'rounded-md border p-3 text-left transition-colors',
                      active ? 'border-primary bg-primary/5 font-medium' : 'opacity-60',
                      clickable ? 'cursor-pointer hover:border-primary/40' : 'cursor-not-allowed',
                    )}
                  >
                    <p className="text-2xs text-muted-foreground uppercase">
                      Passo
                      {step}
                    </p>
                    <p className="truncate text-sm font-semibold">{label}</p>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* STEP 1: GENERAL */}
        {currentStep === 1 && (
          <Card>
            <CardHeader><CardTitle>Informações Gerais</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*"
              />

              <div
                onClick={() => !form.image_url && !isUploading && fileInputRef.current?.click()}
                className={cn(
                  `
                    group relative flex h-44 flex-col items-center justify-center overflow-hidden rounded-xl border-2
                    border-dashed p-6 transition-colors
                  `,
                  form.image_url
                    ? 'border-muted bg-muted/10'
                    : `cursor-pointer border-muted-foreground/20 bg-muted/30 hover:bg-muted/50`,
                )}
              >
                {isUploading && (
                  <div className="
                    absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/60
                  "
                  >
                    <Loader2Icon className="size-8 animate-spin text-primary" />
                    <p className="text-xs font-bold">Enviando imagem...</p>
                  </div>
                )}

                {form.image_url
                  ? (
                      <div className="absolute inset-0 size-full">
                        <img src={form.image_url} alt="Preview" className="size-full object-cover" />
                        <div className="
                          absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0
                          transition-opacity
                          group-hover:opacity-100
                        "
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                            className="font-bold"
                          >
                            Trocar Foto
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleFieldChange('image_url', '') }}
                            className="font-bold"
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    )
                  : (
                      <div className="flex w-full flex-col items-center gap-4">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <div className="
                            rounded-full border bg-background p-3 shadow-sm transition-transform
                            group-hover:scale-110
                          "
                          >
                            <ImageUp className="size-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold">Imagem do Evento</p>
                            <p className="text-2xs opacity-70">Clique para enviar do PC ou cole um link abaixo</p>
                          </div>
                        </div>

                        <div onClick={e => e.stopPropagation()} className="w-full max-w-xs space-y-2">
                          <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                              <ExternalLinkIcon className="size-3 text-muted-foreground" />
                            </div>
                            <Input
                              type="text"
                              placeholder="Cole a URL aqui..."
                              className="h-9 bg-background pl-8 text-xs shadow-inner"
                              value={form.image_url}
                              onChange={e => handleFieldChange('image_url', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
              </div>

              <div className="space-y-2">
                <Label>Título do Evento</Label>
                <Input
                  value={form.title}
                  onChange={e => handleFieldChange('title', e.target.value)}
                  placeholder="Ex: Neymar vai fazer gol hoje?"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input
                  value={form.slug}
                  onChange={e => handleFieldChange('slug', e.target.value)}
                  placeholder="slug-do-evento"
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Resolução</Label>
                <Input
                  type="datetime-local"
                  value={form.endDateIso}
                  onChange={e => handleFieldChange('endDateIso', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria Principal</Label>
                <Select value={form.mainCategorySlug} onValueChange={v => handleFieldChange('mainCategorySlug', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {mainCategories.map((cat: any) => (
                      <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: STRUCTURE */}
        {currentStep === 2 && (
          <Card>
            <CardHeader><CardTitle>Estrutura do Mercado</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Tipo de Mercado</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleFieldChange('marketMode', 'binary')}
                    className={cn(
                      'group flex h-full flex-col items-center gap-4 rounded-xl border p-8 transition-all',
                      form.marketMode === 'binary'
                        ? 'border-primary bg-primary/10 ring-2 ring-primary ring-inset'
                        : `bg-background hover:bg-muted/50`,
                    )}
                  >
                    <CheckIcon className={cn('size-10 transition-transform group-hover:scale-110', form.marketMode === 'binary'
                      ? `text-primary`
                      : `text-muted-foreground`)}
                    />
                    <div className="text-center">
                      <p className="text-lg font-extrabold">Binário</p>
                      <p className="mt-1 text-2xs font-bold tracking-widest uppercase opacity-70">SIM / NÃO / RESULTADO ÚNICO</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('marketMode', 'multi_unique')}
                    className={cn(
                      'group flex h-full flex-col items-center gap-4 rounded-xl border p-8 transition-all',
                      form.marketMode === 'multi_unique'
                        ? 'border-primary bg-primary/10 ring-2 ring-primary ring-inset'
                        : `bg-background hover:bg-muted/50`,
                    )}
                  >
                    <PlusIcon className={cn('size-10 transition-transform group-hover:scale-110', form.marketMode === 'multi_unique'
                      ? `text-primary`
                      : `text-muted-foreground`)}
                    />
                    <div className="text-center">
                      <p className="text-lg font-extrabold">Múltiplo</p>
                      <p className="mt-1 text-2xs font-bold tracking-widest uppercase opacity-70">ESCOLHA ENTRE VÁRIAS OPÇÕES</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-4 border-t pt-6 font-semibold">
                <Label className="text-sm font-bold opacity-70">Engine de Execução (Motor)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleFieldChange('marketType', 'clob')}
                    className={cn(
                      'group flex h-full flex-col items-center gap-4 rounded-xl border p-8 transition-all',
                      form.marketType === 'clob'
                        ? 'border-primary bg-primary/10 ring-2 ring-primary ring-inset'
                        : `bg-background hover:bg-muted/50`,
                    )}
                  >
                    <LayersIcon className={cn('size-10 transition-transform group-hover:scale-110', form.marketType === 'clob'
                      ? `text-primary`
                      : `text-muted-foreground`)}
                    />
                    <div className="text-center">
                      <p className="text-lg font-extrabold">CLOB (Web3)</p>
                      <p className="mt-1 text-2xs font-bold tracking-widest uppercase opacity-70">Livro de Ordens / Tradicional</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('marketType', 'livePool')}
                    className={cn(
                      'group flex h-full flex-col items-center gap-4 rounded-xl border p-8 transition-all',
                      form.marketType === 'livePool'
                        ? 'border-primary bg-primary/10 ring-2 ring-primary ring-inset'
                        : `bg-background hover:bg-muted/50`,
                    )}
                  >
                    <ZapIcon className={cn('size-10 transition-transform group-hover:scale-110', form.marketType === 'livePool'
                      ? `text-primary`
                      : `text-muted-foreground`)}
                    />
                    <div className="text-center">
                      <p className="text-lg font-extrabold">LivePool (Fast)</p>
                      <p className="mt-1 text-2xs font-bold tracking-widest uppercase opacity-70">Pool de Liquidez / Resposta Rápida</p>
                    </div>
                  </button>
                </div>
              </div>

              {form.marketMode === 'binary'
                ? (
                    <div className="space-y-4 border-t pt-6">
                      <Label>Rótulos de Resultado</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-2xs font-bold text-muted-foreground uppercase">Positivo (Lado Comprador)</p>
                          <Input value={form.binaryOutcomeYes} onChange={e => handleFieldChange('binaryOutcomeYes', e.target.value)} placeholder="Sim" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-2xs font-bold text-muted-foreground uppercase">Negativo (Lado Vendedor)</p>
                          <Input value={form.binaryOutcomeNo} onChange={e => handleFieldChange('binaryOutcomeNo', e.target.value)} placeholder="Não" />
                        </div>
                      </div>
                    </div>
                  )
                : (
                    <div className="space-y-4 border-t pt-6">
                      <div className="flex items-center justify-between">
                        <Label>Opções do Mercado</Label>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleFieldChange('options', [...form.options, createOption(`opt-${form.options.length + 1}`)])}>
                          <PlusIcon className="mr-1 size-4" />
                          {' '}
                          Add Opção
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {form.options.map((opt: any, idx: number) => (
                          <div key={opt.id} className="flex items-center gap-2 rounded-lg border p-3">
                            <span className="w-6 text-xs font-bold">
                              {idx + 1}
                              .
                            </span>
                            <Input
                              className="flex-1"
                              placeholder="Título da Opção"
                              value={opt.title}
                              onChange={(e) => {
                                const next = [...form.options]
                                next[idx].title = e.target.value
                                handleFieldChange('options', next)
                              }}
                            />
                            <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => handleFieldChange('options', form.options.filter((o: any) => o.id !== opt.id))}>
                              <Trash2Icon className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
            </CardContent>
          </Card>
        )}

        {/* STEP 3: RESOLUTION */}
        {currentStep === 3 && (
          <Card>
            <CardHeader><CardTitle>Regras e Resolução</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Fonte de Dados Oficial (URL)</Label>
                <Input
                  value={form.resolutionSource}
                  onChange={e => handleFieldChange('resolutionSource', e.target.value)}
                  placeholder="https://g1.globo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Condições para Liquidação</Label>
                <Textarea
                  value={form.resolutionRules}
                  onChange={e => handleFieldChange('resolutionRules', e.target.value)}
                  placeholder="Se o evento for adiado por mais de 24h, o mercado será anulado..."
                  className="min-h-[200px]"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: REVIEW & PUBLISH */}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Finalizar Publicação</CardTitle>
              <CardDescription>Revise as configurações de automação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-5">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 font-bold">
                    <SparkleIcon className="size-4 text-primary" />
                    Resolução Automática via IA
                  </p>
                  <p className="text-xs text-muted-foreground">Nosso robô usará a fonte de dados para liquidar o mercado assim que ele expirar.</p>
                </div>
                <Switch checked={autoResolve} onCheckedChange={setAutoResolve} />
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold opacity-70">ESTADO INICIAL</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPublishImmediately(true)}
                    className={cn(
                      'group flex h-full flex-col items-center gap-4 rounded-xl border p-8 transition-all',
                      publishImmediately
                        ? 'border-primary bg-primary/10 ring-2 ring-primary ring-inset'
                        : `bg-background hover:bg-muted/50`,
                    )}
                  >
                    <SendHorizontal className={cn('size-10 transition-transform group-hover:scale-110', publishImmediately
                      ? `text-primary`
                      : `text-muted-foreground`)}
                    />
                    <div className="text-center">
                      <p className="text-lg font-extrabold">Publicar Agora</p>
                      <p className="mt-1 text-2xs font-bold tracking-widest uppercase opacity-70">Disponível para Apostas</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishImmediately(false)}
                    className={cn(
                      'group flex h-full flex-col items-center gap-4 rounded-xl border p-8 transition-all',
                      !publishImmediately
                        ? 'border-primary bg-primary/10 ring-2 ring-primary ring-inset'
                        : `bg-background hover:bg-muted/50`,
                    )}
                  >
                    <FileText className={cn('size-10 transition-transform group-hover:scale-110', !publishImmediately
                      ? `text-primary`
                      : `text-muted-foreground`)}
                    />
                    <div className="text-center">
                      <p className="text-lg font-extrabold">Salvar Rascunho</p>
                      <p className="mt-1 text-2xs font-bold tracking-widest uppercase opacity-70">Apenas Painel Admin</p>
                    </div>
                  </button>
                </div>
              </div>

              {publishError && (
                <div className="
                  flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm
                  font-bold text-destructive
                "
                >
                  <CircleHelpIcon className="size-4" />
                  Erro de Publicação:
                  {' '}
                  {publishError}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* FOOTER */}
        <Card className="mt-6 bg-background">
          <CardContent className="flex items-center justify-between py-4">
            <Button
              type="button"
              variant="outline"
              className="
                border-dashed text-muted-foreground transition-colors
                hover:bg-destructive/5 hover:text-destructive
              "
              onClick={() => setResetFormDialogOpen(true)}
              disabled={isPublishing}
            >
              <RotateCcwIcon className="mr-2 size-4" />
              Limpar Tudo
            </Button>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={goBack}
                disabled={currentStep === 1 || isPublishing}
              >
                <ArrowLeftIcon className="mr-2 size-4" />
                Voltar
              </Button>

              {!publishDone
                ? (
                    <Button
                      type="button"
                      size="lg"
                      onClick={goNext}
                      disabled={isPublishing}
                      className={cn(
                        'px-8 font-bold transition-all',
                        currentStep === TOTAL_STEPS && `
                          scale-105 bg-primary shadow-lg shadow-primary/20
                          hover:bg-primary/90
                        `,
                      )}
                    >
                      {currentStep === TOTAL_STEPS
                        ? (
                            isPublishing
                              ? (
                                  <>
                                    <Loader2Icon className="mr-2 size-5 animate-spin" />
                                    Finalizando...
                                  </>
                                )
                              : (
                                  <>
                                    <SendHorizontal className="mr-2 size-5" />
                                    {publishImmediately ? 'Confirmar Publicação' : 'Confirmar Rascunho'}
                                  </>
                                )
                          )
                        : (
                            <>
                              Continuar
                              <ArrowRightIcon className="ml-2 size-4" />
                            </>
                          )}
                    </Button>
                  )
                : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 font-bold text-emerald-600">
                        <CheckIcon className="size-6" />
                        <span>Redirecionando para o calendário...</span>
                      </div>
                      <Button
                        type="button"
                        size="lg"
                        className="bg-emerald-600 shadow-lg shadow-emerald-200 hover:bg-emerald-700"
                        onClick={() => router.push('/admin/events/calendar')}
                      >
                        <ArrowRightIcon className="mr-2 size-5" />
                        Ir agora
                      </Button>
                    </div>
                  )}
            </div>
          </CardContent>
        </Card>
      </form>

      {/* DIALOGS */}
      <Dialog open={resetFormDialogOpen} onOpenChange={setResetFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limpar todos os campos?</DialogTitle>
            <DialogDescription>
              Isso removerá todo o progresso atual. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetFormDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => window.location.reload()}>Limpar Definitivamente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
