import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './quiz.module.css'
import { Button, Icon, Segmented, TargetRing, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { studentApi } from '../../lib/api.js'

const LETTERS = 'ABCDE'

function OptionList({ question, picked, onPick, reveal }) {
  const t = useT()
  return (
    <ol className={styles.options}>
      {question.options.map((opt, i) => {
        const state = reveal ? (i === question.answer ? 'correct' : i === picked ? 'wrong' : 'idle') : 'idle'
        const suffix = state === 'correct' ? ` (${t('community.quiz.rightAnswer')})` : state === 'wrong' ? ` (${t('community.quiz.yourAnswer')})` : ''
        return (
          <li key={i}>
            <button type="button" className={styles.option} data-state={state} disabled={reveal} onClick={() => onPick?.(i)} aria-pressed={picked === i ? 'true' : 'false'} aria-label={`${t('community.quiz.optionN', { letter: LETTERS[i] })} ${opt}${suffix}`}>
              <span className={styles.letter} aria-hidden="true">
                {state === 'correct' ? <Icon name="check" size={16} /> : state === 'wrong' ? <Icon name="x" size={16} /> : LETTERS[i]}
              </span>
              <span className={styles.optionText}>
                {opt}
                {suffix ? <span className="sr-only">{suffix}</span> : null}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function Explanation({ question, picked }) {
  const t = useT()
  const right = picked === question.answer
  return (
    <div className={styles.explain} data-right={right ? 'true' : 'false'} role="status">
      <span className={styles.explainHead}>
        <Icon name={right ? 'check' : 'info'} size={16} />
        {right ? t('community.quiz.right') : t('community.quiz.wrong', { letter: LETTERS[question.answer] })}
      </span>
      {question.explanation ? <p>{question.explanation}</p> : null}
    </div>
  )
}

function QuizStats({ best, attempts, total, newBest }) {
  const t = useT()
  return (
    <dl className={styles.stats} aria-label={t('community.quiz.statsLabel')}>
      <div className={styles.stat}>
        <dt>{t('community.quiz.bestLabel')}</dt>
        <dd>
          <span className={styles.statValue}>{t('community.quiz.bestValue', { best, total })}</span>
          {newBest ? (
            <span className={styles.newBest}>
              <Icon name="star" size={14} />
              {t('community.quiz.newBest')}
            </span>
          ) : null}
        </dd>
      </div>
      <div className={styles.stat}>
        <dt>{t('community.quiz.attemptsLabel')}</dt>
        <dd>
          <span className={styles.statValue}>{attempts}</span>
        </dd>
      </div>
    </dl>
  )
}

function ReviewOffer({ count, review, onReview }) {
  const t = useT()
  if (review.status === 'done') {
    return (
      <div className={styles.review} data-state="done" role="status">
        <span className={styles.reviewIcon} aria-hidden="true">
          <Icon name="check" size={20} />
        </span>
        <div className={styles.reviewBody}>
          <p className={styles.reviewTitle}>{t('community.quiz.reviewDone', { count: review.cards })}</p>
        </div>
        <Button variant="soft" iconRight="arrowRight" to={`/app/decks/${review.deckId}`}>
          {t('community.quiz.openDeck')}
        </Button>
      </div>
    )
  }
  return (
    <div className={styles.review}>
      <span className={styles.reviewIcon} aria-hidden="true">
        <Icon name="layers" size={20} />
      </span>
      <div className={styles.reviewBody}>
        <span className={styles.eyebrow}>{t('community.quiz.reviewEyebrow')}</span>
        <p className={styles.reviewTitle}>{t('community.quiz.reviewTitle')}</p>
        <p className={styles.reviewText}>{t('community.quiz.reviewText', { count })}</p>
      </div>
      <Button icon="sparkle" loading={review.status === 'loading'} onClick={onReview}>
        {t('community.quiz.reviewCta')}
      </Button>
    </div>
  )
}

function Player({ questions, materialId, bestSoFar, onSaved }) {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [finished, setFinished] = useState(false)
  const [saved, setSaved] = useState(null)
  const [review, setReview] = useState({ status: 'idle' })
  const done = Object.keys(answers).length === questions.length
  const q = questions[index]
  const picked = answers[q.id]
  const score = questions.filter((x) => answers[x.id] === x.answer).length
  const wrongCount = questions.length - score

  const finish = async () => {
    setFinished(true)
    if (!materialId || saved) return
    setSaved({ status: 'saving' })
    try {
      const res = await studentApi.post(`/community/materials/${materialId}/quiz-attempts`, { answers })
      setSaved({ status: 'saved', ...res, newBest: bestSoFar != null && res.best > bestSoFar })
      onSaved?.({ best: res.best, attempts: res.attempts, last: { score: res.score, total: res.total, wrong: res.wrong } })
    } catch (err) {
      setSaved({ status: 'error' })
      toast.show({ message: err.message || t('community.quiz.saveError'), tone: 'danger' })
    }
  }

  const createReview = async () => {
    setReview({ status: 'loading' })
    try {
      const res = await studentApi.post(`/community/materials/${materialId}/quiz-review`)
      setReview({ status: 'done', ...res })
      toast.show({ message: t('community.quiz.reviewToast', { count: res.cards }), icon: 'layers', action: { label: t('community.quiz.openDeck'), onClick: () => navigate(`/app/decks/${res.deckId}`) } })
    } catch (err) {
      setReview({ status: 'idle' })
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const restart = () => {
    setAnswers({})
    setIndex(0)
    setFinished(false)
    setSaved(null)
    setReview({ status: 'idle' })
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className={styles.result}>
        <div className={styles.resultMain}>
          <TargetRing value={score} max={questions.length} size={148} center={<span className={styles.resultPct}>{pct}%</span>} />
          <div className={styles.resultBody}>
            <span className={styles.eyebrow}>{t('community.quiz.resultEyebrow')}</span>
            <h3 className={styles.resultTitle}>{t('community.quiz.resultTitle', { score, total: questions.length })}</h3>
            <p className={styles.resultText}>{pct >= 70 ? t('community.quiz.resultGood') : t('community.quiz.resultReview')}</p>
            <ol className={styles.resultDots} aria-label={t('community.quiz.summary')}>
              {questions.map((x, i) => (
                <li key={x.id} data-right={answers[x.id] === x.answer ? 'true' : 'false'}>
                  <button
                    type="button"
                    onClick={() => {
                      setFinished(false)
                      setIndex(i)
                    }}
                  >
                    {i + 1}
                    <span className="sr-only">: {answers[x.id] === x.answer ? t('community.quiz.right') : t('community.quiz.wrongShort')}</span>
                  </button>
                </li>
              ))}
            </ol>
            <Button variant="soft" icon="refresh" onClick={restart}>
              {t('community.quiz.restart')}
            </Button>
          </div>
          {materialId ? (
            <div className={styles.resultSide} aria-live="polite">
              {saved?.status === 'saved' ? (
                <QuizStats best={saved.best} attempts={saved.attempts} total={saved.total} newBest={saved.newBest} />
              ) : saved?.status === 'saving' ? (
                <p className={styles.saving}>
                  <span className={styles.savingDot} aria-hidden="true" />
                  {t('community.quiz.saving')}
                </p>
              ) : saved?.status === 'error' ? (
                <p className={styles.saveError}>{t('community.quiz.saveError')}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        {materialId && saved?.status === 'saved' ? (
          wrongCount > 0 ? (
            <ReviewOffer count={wrongCount} review={review} onReview={createReview} />
          ) : (
            <p className={styles.perfect}>
              <Icon name="trophy" size={18} />
              {t('community.quiz.perfect')}
            </p>
          )
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.player}>
      <div className={styles.progress}>
        <span className={styles.progressLabel}>{t('community.quiz.progress', { n: index + 1, total: questions.length })}</span>
        <ol className={styles.progressBar} aria-hidden="true">
          {questions.map((x, i) => (
            <li key={x.id} data-state={answers[x.id] === undefined ? (i === index ? 'current' : 'todo') : answers[x.id] === x.answer ? 'right' : 'wrong'} />
          ))}
        </ol>
        <span className={styles.progressScore}>{t('community.quiz.score', { score, total: Object.keys(answers).length })}</span>
      </div>
      <fieldset className={styles.question}>
        <legend className={styles.prompt}>
          <span className={styles.qNum} aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          {q.prompt}
        </legend>
        <OptionList question={q} picked={picked} reveal={picked !== undefined} onPick={(i) => setAnswers((a) => ({ ...a, [q.id]: i }))} />
      </fieldset>
      {picked !== undefined ? <Explanation question={q} picked={picked} /> : <p className={styles.hint}>{t('community.quiz.pickHint')}</p>}
      <div className={styles.nav}>
        <Button variant="ghost" icon="chevronLeft" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          {t('community.quiz.prev')}
        </Button>
        {index < questions.length - 1 ? (
          <Button iconRight="chevronRight" variant={picked !== undefined ? 'primary' : 'ghost'} onClick={() => setIndex(index + 1)}>
            {t('community.quiz.next')}
          </Button>
        ) : (
          <Button icon="trophy" disabled={!done} onClick={finish}>
            {t('community.quiz.finish')}
          </Button>
        )}
      </div>
    </div>
  )
}

function AnswerKey({ questions }) {
  return (
    <ol className={styles.key}>
      {questions.map((q, i) => (
        <li key={q.id} className={styles.keyItem}>
          <p className={styles.prompt}>
            <span className={styles.qNum} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            {q.prompt}
          </p>
          <OptionList question={q} picked={undefined} reveal />
          {q.explanation ? <p className={styles.keyExplain}>{q.explanation}</p> : null}
        </li>
      ))}
    </ol>
  )
}

export function QuizView({ questions, materialId, viewerQuiz }) {
  const t = useT()
  const [mode, setMode] = useState('play')
  const [record, setRecord] = useState(viewerQuiz || null)
  return (
    <div className={styles.quiz}>
      <div className={styles.quizBar}>
        <Segmented
          label={t('community.quiz.modeLabel')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'play', label: t('community.quiz.play'), icon: 'play' },
            { value: 'key', label: t('community.quiz.key'), icon: 'list' }
          ]}
        />
        {materialId && record?.attempts ? (
          <span className={styles.history}>
            <Icon name="trophy" size={16} />
            {t('community.quiz.history', { best: record.best, total: questions.length, count: record.attempts })}
          </span>
        ) : null}
      </div>
      {mode === 'play' ? <Player questions={questions} materialId={materialId} bestSoFar={record?.best} onSaved={setRecord} /> : <AnswerKey questions={questions} />}
    </div>
  )
}

export function QuizMini({ sample, options = 4, count }) {
  const t = useT()
  return (
    <span className={styles.mini} aria-hidden="true">
      <span className={styles.miniHead}>
        <span className={styles.miniBadge}>{t('community.questions', { count })}</span>
      </span>
      <span className={styles.miniPrompt}>{sample}</span>
      <span className={styles.miniOptions}>
        {Array.from({ length: Math.min(options, 4) }).map((_, i) => (
          <span key={i} className={styles.miniOption} data-right={i === 1 ? 'true' : 'false'}>
            <span className={styles.miniLetter}>{LETTERS[i]}</span>
            <span className={styles.miniLine} style={{ width: `${[72, 58, 80, 50][i]}%` }} />
          </span>
        ))}
      </span>
    </span>
  )
}

export function TimelineView({ events }) {
  const t = useT()
  return (
    <div className={styles.timeline}>
      <div className={styles.axis} aria-hidden="true">
        <span className={styles.axisEnd}>{events[0].when}</span>
        <span className={styles.axisTrack}>
          {events.map((e, i) => (
            <span key={e.id} className={styles.axisDot} style={{ left: `${events.length > 1 ? (i / (events.length - 1)) * 100 : 0}%` }} />
          ))}
        </span>
        <span className={styles.axisEnd}>{events[events.length - 1].when}</span>
      </div>
      <ol className={styles.events} aria-label={t('community.timelineView.label', { count: events.length })}>
        {events.map((e, i) => (
          <li key={e.id} className={styles.event} data-side={i % 2 ? 'right' : 'left'}>
            <span className={styles.eventDot} aria-hidden="true">
              {i + 1}
            </span>
            <div className={styles.eventCard}>
              <span className={styles.eventWhen}>{e.when}</span>
              <h3 className={styles.eventTitle}>{e.label}</h3>
              {e.note ? <p className={styles.eventNote}>{e.note}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function TimelineMini({ marks = [], from, to }) {
  const shown = marks.slice(0, 5)
  return (
    <span className={styles.tmini} aria-hidden="true">
      <span className={styles.tminiTrack}>
        {shown.map((m, i) => (
          <span key={`${m.when}-${i}`} className={styles.tminiMark} style={{ left: `${shown.length > 1 ? (i / (shown.length - 1)) * 100 : 50}%` }} data-up={i % 2 ? 'true' : 'false'}>
            <span className={styles.tminiWhen}>{m.when}</span>
          </span>
        ))}
      </span>
      {from && to ? (
        <span className={styles.tminiSpan}>
          {from} → {to}
        </span>
      ) : null}
    </span>
  )
}
