import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './profile.module.css'
import { Banner, Button, Input, Panel, Screen, ScreenHeader, Segmented, Select, Skeleton, Textarea, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { Markdown } from '../community/Markdown.jsx'
import { usePublishMaterial } from '../community/MyContents.jsx'

const EMPTY = { title: '', description: '', text: '', categoryId: 'outros', tags: '', url: '', outlet: '' }

export function BlogEditor() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const { postId } = useParams()
  const isNew = !postId
  const [form, setForm] = useState(EMPTY)
  const [view, setView] = useState('write')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const categories = useAsync(() => studentApi.get('/decks').then((d) => d.categories), [])
  const existing = useAsync(() => (isNew ? Promise.resolve(null) : studentApi.get(`/community/materials/${postId}`)), [postId])
  useDocumentTitle(isNew ? t('profile.blog.newTitle') : t('profile.blog.editTitle'))
  const publish = usePublishMaterial(() => navigate('/app/perfil#meu-blog'))

  useEffect(() => {
    const m = existing.data?.material
    if (!m) return
    setForm({ title: m.title, description: m.description || '', text: m.body.markdown || '', categoryId: m.categoryId, tags: (m.tags || []).join(', '), url: m.body.url || '', outlet: m.body.outlet || '' })
    setSaved(m)
  }, [existing.data])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const payload = () => ({ kind: 'noticia', title: form.title, description: form.description, text: form.text, categoryId: form.categoryId, tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean), url: form.url || null, outlet: form.outlet || null })
  const valid = form.title.trim() && form.description.trim() && form.text.trim().length >= 40

  const save = async (thenShare = false) => {
    setSaving(true)
    try {
      const res = saved ? await studentApi.patch(`/me/materials/${saved.id}`, payload()) : await studentApi.post('/me/materials', payload())
      setSaved(res.material)
      toast.show({ message: t('profile.blog.saved'), icon: 'check' })
      if (thenShare) publish.ask(res.material)
      else if (isNew) navigate(`/app/perfil/blog/${res.material.id}`, { replace: true })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  if (!isNew && existing.loading && !existing.data) return <Skeleton height={160} count={3} />
  if (!isNew && existing.error) {
    return (
      <Banner tone="danger" icon="alert">
        {t('community.material.notFound')}
      </Banner>
    )
  }

  const words = form.text.split(/\s+/).filter(Boolean).length

  return (
    <Screen>
      <ScreenHeader
        crumbs={[{ label: t('profile.title'), to: '/app/perfil' }, { label: t('profile.blog.title'), to: '/app/perfil#meu-blog' }, { label: isNew ? t('profile.blog.newTitle') : form.title || t('profile.blog.editTitle') }]}
        eyebrow={t('profile.blog.eyebrow')}
        title={isNew ? t('profile.blog.newTitle') : t('profile.blog.editTitle')}
        lead={t('profile.blog.editorLead')}
        actions={
          <>
            <Button variant="ghost" icon="check" onClick={() => save(false)} loading={saving} disabled={!valid}>
              {t('profile.blog.saveDraft')}
            </Button>
            <Button icon="send" onClick={() => save(true)} disabled={!valid || saving}>
              {t('profile.blog.saveShare')}
            </Button>
          </>
        }
      />

      {saved?.status === 'aprovado' && saved.audience === 'comunidade' ? (
        <Banner tone="warning" icon="info">
          {t('profile.blog.reModeration')}
        </Banner>
      ) : null}

      <div className={styles.editorLayout}>
        <Panel title={t('profile.blog.content')} icon="edit" labelledBy="post-conteudo">
          <Input label={t('profile.blog.fields.title')} value={form.title} onChange={set('title')} maxLength={140} placeholder={t('profile.blog.placeholders.title')} />
          <Textarea label={t('profile.blog.fields.description')} value={form.description} onChange={set('description')} rows={2} maxLength={400} hint={t('profile.blog.hints.description')} />
          <div className={styles.editorTabs}>
            <span className={styles.editorLabel}>{t('profile.blog.fields.text')}</span>
            <Segmented
              label={t('profile.blog.fields.text')}
              value={view}
              onChange={setView}
              options={[
                { value: 'write', label: t('profile.blog.writeTab') },
                { value: 'preview', label: t('profile.blog.preview') }
              ]}
            />
          </div>
          {view === 'write' ? (
            <Textarea aria-label={t('profile.blog.fields.text')} value={form.text} onChange={set('text')} rows={16} hint={t('profile.blog.hints.text', { words })} placeholder={t('profile.blog.placeholders.text')} />
          ) : (
            <div className={styles.editorPreview}>{form.text.trim() ? <Markdown text={form.text} /> : <p className={styles.meta}>{t('profile.blog.previewEmpty')}</p>}</div>
          )}
        </Panel>

        <div className={styles.editorAside}>
          <Panel title={t('profile.blog.details')} icon="tag" labelledBy="post-detalhes">
            <Select label={t('profile.blog.fields.category')} value={form.categoryId} onChange={set('categoryId')}>
              {(categories.data || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input label={t('profile.blog.fields.tags')} value={form.tags} onChange={set('tags')} hint={t('profile.blog.hints.tags')} />
          </Panel>
          <Panel title={t('profile.blog.sourceTitle')} icon="external" labelledBy="post-fonte">
            <Input label={t('profile.blog.fields.url')} type="url" value={form.url} onChange={set('url')} optional placeholder="https://" />
            <Input label={t('profile.blog.fields.outlet')} value={form.outlet} onChange={set('outlet')} optional hint={t('profile.blog.hints.outlet')} />
          </Panel>
        </div>
      </div>
      {publish.dialog}
    </Screen>
  )
}
