"use client";
import { useApp } from './app-store';
import { initialFinance } from '@/lib/finance/current/plan';
export { INITIAL, parse, type Plan } from '@/lib/finance/current/plan';
export function useTeacherFirstFinance(){const {state,updateCurrentFinance}=useApp();return {finance:state.currentFinance??initialFinance(),setFinance:updateCurrentFinance};}
export function useTeacherFirstPlan(){return useTeacherFirstFinance().finance.plan;}
