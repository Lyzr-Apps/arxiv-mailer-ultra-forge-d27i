import { NextRequest, NextResponse } from 'next/server'
import parseLLMJson from '@/lib/jsonParser'

const LYZR_TASK_URL = 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/task'
const LYZR_API_KEY = process.env.LYZR_API_KEY || ''
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

// Types
interface ArtifactFile {
  file_url: string
  name: string
  format_type: string
}

interface ModuleOutputs {
  artifact_files?: ArtifactFile[]
  [key: string]: any
}

interface NormalizedAgentResponse {
  status: 'success' | 'error'
  result: Record<string, any>
  message?: string
  metadata?: {
    agent_name?: string
    timestamp?: string
    [key: string]: any
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function normalizeResponse(parsed: any): NormalizedAgentResponse {
  if (!parsed) {
    return {
      status: 'error',
      result: {},
      message: 'Empty response from agent',
    }
  }

  if (typeof parsed === 'string') {
    return {
      status: 'success',
      result: { text: parsed },
      message: parsed,
    }
  }

  if (typeof parsed !== 'object') {
    return {
      status: 'success',
      result: { value: parsed },
      message: String(parsed),
    }
  }

  if ('status' in parsed && 'result' in parsed) {
    return {
      status: parsed.status === 'error' ? 'error' : 'success',
      result: parsed.result || {},
      message: parsed.message,
      metadata: parsed.metadata,
    }
  }

  if ('status' in parsed) {
    const { status, message, metadata, ...rest } = parsed
    return {
      status: status === 'error' ? 'error' : 'success',
      result: Object.keys(rest).length > 0 ? rest : {},
      message,
      metadata,
    }
  }

  if ('result' in parsed) {
    const r = parsed.result
    const msg = parsed.message
      ?? (typeof r === 'string' ? r : null)
      ?? (r && typeof r === 'object'
          ? (r.text ?? r.message ?? r.response ?? r.answer ?? r.summary ?? r.content)
          : null)
    return {
      status: 'success',
      result: typeof r === 'string' ? { text: r } : (r || {}),
      message: typeof msg === 'string' ? msg : undefined,
      metadata: parsed.metadata,
    }
  }

  if ('message' in parsed && typeof parsed.message === 'string') {
    return {
      status: 'success',
      result: { text: parsed.message },
      message: parsed.message,
    }
  }

  if ('response' in parsed) {
    return normalizeResponse(parsed.response)
  }

  return {
    status: 'success',
    result: parsed,
    message: undefined,
    metadata: undefined,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, agent_id, user_id, session_id, assets } = body

    if (!message || !agent_id) {
      return NextResponse.json(
        {
          success: false,
          response: {
            status: 'error',
            result: {},
            message: 'message and agent_id are required',
          },
          error: 'message and agent_id are required',
        },
        { status: 400 }
      )
    }

    if (!LYZR_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          response: {
            status: 'error',
            result: {},
            message: 'LYZR_API_KEY not configured',
          },
          error: 'LYZR_API_KEY not configured on server',
        },
        { status: 500 }
      )
    }

    const finalUserId = user_id || `user-${generateUUID()}`
    const finalSessionId = session_id || `${agent_id}-${generateUUID().substring(0, 12)}`

    const payload: Record<string, any> = {
      message,
      agent_id,
      user_id: finalUserId,
      session_id: finalSessionId,
    }

    if (assets && assets.length > 0) {
      payload.assets = assets
    }

    // 1. Submit async task
    const submitRes = await fetch(LYZR_TASK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LYZR_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    if (!submitRes.ok) {
      const submitText = await submitRes.text()
      let errorMsg = `Task submit failed with status ${submitRes.status}`
      try {
        const errorData = JSON.parse(submitText)
        errorMsg = errorData?.detail || errorData?.error || errorData?.message || errorMsg
      } catch {
        try {
          const errorData = parseLLMJson(submitText)
          errorMsg = errorData?.error || errorData?.message || errorMsg
        } catch {}
      }
      return NextResponse.json(
        {
          success: false,
          response: { status: 'error', result: {}, message: errorMsg },
          error: errorMsg,
          raw_response: submitText,
        },
        { status: submitRes.status }
      )
    }

    const { task_id } = await submitRes.json()

    // 2. Poll with adaptive backoff
    const startTime = Date.now()
    let attempt = 0
    let rawText = ''

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      const delay = Math.min(300 * Math.pow(1.5, attempt), 3000)
      await new Promise(r => setTimeout(r, delay))
      attempt++

      let pollRes: Response
      try {
        pollRes = await fetch(`${LYZR_TASK_URL}/${task_id}`, {
          headers: { 'x-api-key': LYZR_API_KEY },
        })
      } catch (pollError) {
        const msg = pollError instanceof Error ? pollError.message : 'Network error during poll'
        return NextResponse.json(
          {
            success: false,
            response: { status: 'error', result: {}, message: msg },
            error: msg,
          },
          { status: 502 }
        )
      }

      if (!pollRes.ok) {
        const pollText = await pollRes.text()
        const msg = pollRes.status === 404
          ? 'Task expired or not found'
          : `Poll failed with status ${pollRes.status}`
        return NextResponse.json(
          {
            success: false,
            response: { status: 'error', result: {}, message: msg },
            error: msg,
            raw_response: pollText,
          },
          { status: pollRes.status }
        )
      }

      const task = await pollRes.json()

      if (task.status === 'completed') {
        rawText = JSON.stringify(task.response)
        break
      }

      if (task.status === 'failed') {
        const msg = task.error || 'Agent task failed'
        return NextResponse.json(
          {
            success: false,
            response: { status: 'error', result: {}, message: msg },
            error: msg,
          },
          { status: 500 }
        )
      }

      // status === 'processing' — continue polling
    }

    if (!rawText) {
      return NextResponse.json(
        {
          success: false,
          response: { status: 'error', result: {}, message: 'Agent task timed out after 5 minutes' },
          error: 'Agent task timed out after 5 minutes',
        },
        { status: 504 }
      )
    }

    // 3. Parse response — same envelope extraction + parseLLMJson + normalizeResponse
    let moduleOutputs: ModuleOutputs | undefined
    let agentResponseRaw: any = rawText

    try {
      const envelope = JSON.parse(rawText)
      if (envelope && typeof envelope === 'object' && 'response' in envelope) {
        moduleOutputs = envelope.module_outputs
        agentResponseRaw = envelope.response
      }
    } catch {
      // Not standard JSON envelope, fall through — parseLLMJson will handle it
    }

    const parsed = parseLLMJson(agentResponseRaw)

    const toNormalize =
      parsed && typeof parsed === 'object' && parsed.success === false && parsed.data === null
        ? agentResponseRaw
        : parsed

    const normalized = normalizeResponse(toNormalize)

    return NextResponse.json({
      success: true,
      response: normalized,
      module_outputs: moduleOutputs,
      agent_id,
      user_id: finalUserId,
      session_id: finalSessionId,
      timestamp: new Date().toISOString(),
      raw_response: rawText,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json(
      {
        success: false,
        response: {
          status: 'error',
          result: {},
          message: errorMsg,
        },
        error: errorMsg,
      },
      { status: 500 }
    )
  }
}
