# HireAI — Agentic HR Screening System

An end-to-end AI-powered recruitment platform that automates candidate screening, resume shortlisting, and initial HR interviews using agentic AI.

## What it does

- Candidates upload resumes through a web portal
- HR posts job descriptions, keywords, and salary budget
- AI matches resumes to JD using RAG pipeline and vector embeddings
- Shortlisted candidates receive automated AI phone calls at their preferred time
- AI conducts salary negotiation and HR screening questions
- Generates structured interview summaries for HR review

## Tech Stack

**Frontend:** Next.js 14, Tailwind CSS, shadcn/ui  
**Backend:** FastAPI, Python  
**AI/ML:** Groq (Llama 3.1 70B), Whisper (STT), Google TTS, ChromaDB, Sentence Transformers  
**RAG Pipeline:** PDF parsing, vector embeddings, cosine similarity scoring  
**Telephony:** Twilio Voice API  
**Database:** Supabase (PostgreSQL)  
**Scheduling:** APScheduler  

## Key ML Concepts

- Retrieval Augmented Generation (RAG) for resume-JD matching
- Vector embeddings with section-weighted similarity scoring
- Agentic decision trees for automated conversation flow
- Real-time speech-to-text transcription
- LLM-powered structured summary generation

## Architecture
Candidate Portal (Next.js) → Resume Upload → RAG Pipeline

HR Portal (Next.js) → JD Input → Vector Store

FastAPI Backend → Scheduler → Twilio Call → AI Conversation → Summary → HR Dashboard

## Setup

See `backend/requirements.txt` for Python dependencies and `package.json` for Node dependencies.

Requires: Supabase, Groq API, Twilio, and ngrok for local development.
