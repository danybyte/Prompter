import { RefinedAspects, RefineResponse } from '../types';
import { PURE_GREETINGS, GREETING_RESPONSE } from './constants';

export function isPureGreeting(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim().toLowerCase().replace(/[.,\/#!$%^&*;:{}=_`~()?]/g, '');
  return PURE_GREETINGS.includes(trimmed);
}

export function sanitizeRefineResponse(payload: any): RefineResponse {
  if (!payload || typeof payload !== 'object') {
    return {
      message: GREETING_RESPONSE,
      aspects: {},
      progressScore: 0,
      isCompleted: false,
      finalPrompt: null
    };
  }

  const rawAspects = payload.aspects || {};
  const primaryGoal = typeof rawAspects.primaryGoal === 'string' ? rawAspects.primaryGoal.trim() : '';
  const cleanGoal = (primaryGoal && !isPureGreeting(primaryGoal)) ? primaryGoal : '';

  const sanitizedAspects: RefinedAspects = {
    primaryGoal: cleanGoal,
    targetAudience: cleanGoal ? (typeof rawAspects.targetAudience === 'string' ? rawAspects.targetAudience.trim() : '') : '',
    toneStyle: cleanGoal ? (typeof rawAspects.toneStyle === 'string' ? rawAspects.toneStyle.trim() : '') : '',
    inputsRequired: cleanGoal ? (typeof rawAspects.inputsRequired === 'string' ? rawAspects.inputsRequired.trim() : '') : '',
    formatOutput: cleanGoal ? (typeof rawAspects.formatOutput === 'string' ? rawAspects.formatOutput.trim() : '') : '',
    constraints: cleanGoal ? (typeof rawAspects.constraints === 'string' ? rawAspects.constraints.trim() : '') : ''
  };

  let progressScore = typeof payload.progressScore === 'number' ? payload.progressScore : 0;
  if (!sanitizedAspects.primaryGoal) progressScore = 0;
  progressScore = Math.max(0, Math.min(100, progressScore));

  return {
    message: payload.message || 'How else can I assist in refining your prompt idea?',
    aspects: sanitizedAspects,
    progressScore,
    isCompleted: !!payload.isCompleted,
    finalPrompt: payload.finalPrompt || null
  };
}
