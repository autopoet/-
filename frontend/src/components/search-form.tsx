import { useQuery } from '@tanstack/react-query'
import { LoaderCircle, Search, X } from 'lucide-react'
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { listSymptoms, symptomKeys } from '../api/symptoms'
import styles from './search-form.module.css'

type SearchFormProps = {
  initialValue?: string
  variant?: 'hero' | 'page'
  showSuggestions?: boolean
  autoFocus?: boolean
}

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeout)
  }, [delay, value])

  return debouncedValue
}

export function SearchForm({
  initialValue = '',
  variant = 'page',
  showSuggestions = true,
  autoFocus = false,
}: SearchFormProps) {
  const navigate = useNavigate()
  const listboxId = useId()
  const [value, setValue] = useState(initialValue)
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [validationMessage, setValidationMessage] = useState('')
  const normalizedValue = value.trim()
  const debouncedValue = useDebouncedValue(normalizedValue, 250)
  const canRequestSuggestions =
    showSuggestions &&
    normalizedValue.length >= 2 &&
    normalizedValue === debouncedValue

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const suggestionQuery = useQuery({
    queryKey: symptomKeys.list(debouncedValue),
    queryFn: ({ signal }) => listSymptoms(debouncedValue, signal),
    enabled: canRequestSuggestions,
  })

  const suggestions = suggestionQuery.data?.items.slice(0, 6) ?? []
  const suggestionPanelOpen =
    focused && canRequestSuggestions && showSuggestions

  function goToSearch(searchValue: string) {
    const keyword = searchValue.trim()
    if (keyword.length === 1) {
      setValidationMessage('请至少输入 2 个字符')
      return
    }

    setValidationMessage('')
    const params = new URLSearchParams()
    if (keyword) {
      params.set('q', keyword)
    }
    navigate(`/explore${params.size ? `?${params.toString()}` : ''}`)
    setFocused(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    goToSearch(value)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) {
      return
    }

    if (!suggestionPanelOpen || suggestions.length === 0) {
      if (event.key === 'Escape') {
        setFocused(false)
        event.currentTarget.blur()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      )
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      navigate(`/articles/${suggestions[activeIndex].id}`)
      setFocused(false)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setFocused(false)
      event.currentTarget.blur()
    }
  }

  return (
    <form
      className={`${styles.form} ${styles[variant]}`}
      role="search"
      onSubmit={handleSubmit}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false)
          setActiveIndex(-1)
        }
      }}
    >
      <label className="sr-only" htmlFor={`${listboxId}-input`}>
        搜索故障现象
      </label>
      <div className={styles.control}>
        <Search className={styles.searchIcon} aria-hidden="true" size={20} />
        <input
          id={`${listboxId}-input`}
          className={styles.input}
          type="search"
          name="q"
          value={value}
          maxLength={20}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="描述故障现象、器件或错误信息…"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestionPanelOpen}
          aria-invalid={validationMessage ? true : undefined}
          aria-controls={suggestionPanelOpen ? listboxId : undefined}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-describedby={
            validationMessage ? `${listboxId}-error` : undefined
          }
          onChange={(event) => {
            setValue(event.target.value)
            setValidationMessage('')
            setActiveIndex(-1)
          }}
          onKeyDown={handleKeyDown}
        />
        {suggestionQuery.isFetching ? (
          <LoaderCircle
            className={styles.loader}
            aria-label="正在加载搜索建议"
            size={18}
          />
        ) : null}
        {value ? (
          <button
            className={styles.clearButton}
            type="button"
            aria-label="清空搜索"
            onClick={() => {
              setValue('')
              setValidationMessage('')
              setActiveIndex(-1)
            }}
          >
            <X aria-hidden="true" size={18} />
          </button>
        ) : null}
        <button
          className={styles.submitButton}
          type="submit"
          aria-label="搜索"
        >
          <Search aria-hidden="true" size={18} />
          <span>搜索</span>
        </button>
      </div>

      {validationMessage ? (
        <p
          id={`${listboxId}-error`}
          className={styles.validation}
          role="alert"
        >
          {validationMessage}
        </p>
      ) : null}

      {suggestionPanelOpen ? (
        <div className={styles.suggestions} id={listboxId} role="listbox">
          {suggestionQuery.isLoading ? (
            <p className={styles.suggestionMessage}>正在匹配故障现象…</p>
          ) : null}
          {suggestionQuery.isError ? (
            <p className={styles.suggestionMessage}>
              暂时无法加载建议，按 Enter 查看搜索结果
            </p>
          ) : null}
          {suggestionQuery.isSuccess && suggestions.length === 0 ? (
            <p className={styles.suggestionMessage}>
              没有直接匹配，按 Enter 查看完整结果
            </p>
          ) : null}
          {suggestions.map((symptom, index) => (
            <button
              key={symptom.id}
              id={`${listboxId}-option-${index}`}
              className={`${styles.suggestion} ${
                index === activeIndex ? styles.suggestionActive : ''
              }`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => {
                navigate(`/articles/${symptom.id}`)
                setFocused(false)
              }}
            >
              <span className={styles.suggestionTitle}>{symptom.name}</span>
              <span className={styles.suggestionDescription}>
                {symptom.description}
              </span>
            </button>
          ))}
          {suggestions.length > 0 ? (
            <button
              className={styles.viewAll}
              type="button"
              onClick={() => goToSearch(value)}
            >
              查看全部搜索结果
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}
