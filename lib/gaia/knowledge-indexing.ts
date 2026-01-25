// Rosa Knowledge Document Indexing Pipeline
// Processes uploaded documents, chunks them, and generates embeddings for RAG

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

type SupabaseClient = ReturnType<typeof createClient>;

// Types for document processing
export type DocumentCategory =
  | 'ghg_protocol'
  | 'sbti'
  | 'regulations'
  | 'industry_standards'
  | 'best_practices'
  | 'case_studies'
  | 'certifications'
  | 'methodology'
  | 'training'
  | 'other';

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'archived';

export interface KnowledgeDocument {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSizeBytes?: number;
  category: DocumentCategory;
  tags: string[];
  sourceName?: string;
  sourceUrl?: string;
  publicationDate?: Date;
  status: DocumentStatus;
  processingError?: string;
  chunkCount: number;
  isPublic: boolean;
  organizationId?: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  sectionTitle?: string;
  pageNumber?: number;
  tokenCount?: number;
  embedding?: number[];
}

export interface ProcessingResult {
  success: boolean;
  documentId: string;
  chunksCreated: number;
  error?: string;
}

// Configuration
const MAX_CHUNK_SIZE = 1500; // Maximum chunk size
const CHUNK_OVERLAP = 200; // Token overlap between chunks
const EMBEDDING_MODEL = 'text-embedding-004'; // Google's embedding model

/**
 * Initialize the Gemini client for embeddings
 */
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Process a newly uploaded document
 * This is the main entry point called after a document is uploaded
 */
export async function processDocument(
  supabase: SupabaseClient,
  documentId: string
): Promise<ProcessingResult> {
  try {
    // Update status to processing
    await supabase
      .from('rosa_knowledge_documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Fetch the document
    const { data: document, error: fetchError } = await supabase
      .from('rosa_knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Download the file content
    const fileContent = await downloadAndExtractText(document.file_url, document.file_type);

    if (!fileContent || fileContent.trim().length === 0) {
      throw new Error('No text content could be extracted from the document');
    }

    // Chunk the content
    const chunks = chunkDocument(fileContent, document.title);

    // Generate embeddings for each chunk
    const chunksWithEmbeddings = await generateEmbeddings(chunks);

    // Store chunks in database
    const chunkRecords = chunksWithEmbeddings.map((chunk, index) => ({
      document_id: documentId,
      content: chunk.content,
      chunk_index: index,
      section_title: chunk.sectionTitle,
      page_number: chunk.pageNumber,
      token_count: chunk.tokenCount,
      embedding: `[${chunk.embedding?.join(',')}]`, // pgvector format
    }));

    // Insert chunks in batches
    const batchSize = 10;
    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('rosa_knowledge_chunks')
        .insert(batch);

      if (insertError) {
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }
    }

    // Update document status
    await supabase
      .from('rosa_knowledge_documents')
      .update({
        status: 'ready',
        chunk_count: chunkRecords.length,
        processed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    return {
      success: true,
      documentId,
      chunksCreated: chunkRecords.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update document with error status
    await supabase
      .from('rosa_knowledge_documents')
      .update({
        status: 'failed',
        processing_error: errorMessage,
      })
      .eq('id', documentId);

    console.error(`Error processing document ${documentId}:`, error);

    return {
      success: false,
      documentId,
      chunksCreated: 0,
      error: errorMessage,
    };
  }
}

/**
 * Download file from storage and extract text content
 */
async function downloadAndExtractText(fileUrl: string, fileType: string): Promise<string> {
  // Fetch the file
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const contentType = fileType.toLowerCase();

  // Handle different file types
  if (contentType === 'txt' || contentType === 'md') {
    return await response.text();
  }

  if (contentType === 'html') {
    const html = await response.text();
    return extractTextFromHtml(html);
  }

  if (contentType === 'pdf') {
    // For PDFs, we'll use Gemini's vision capability to extract text
    const arrayBuffer = await response.arrayBuffer();
    return await extractTextFromPdf(arrayBuffer);
  }

  if (contentType === 'docx') {
    // For DOCX, we'll use a simple extraction
    const arrayBuffer = await response.arrayBuffer();
    return await extractTextFromDocx(arrayBuffer);
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

/**
 * Extract text from HTML content
 */
function extractTextFromHtml(html: string): string {
  // Simple HTML to text conversion
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract text from PDF using Gemini Vision
 */
async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Convert PDF to base64
  const base64 = Buffer.from(pdfBuffer).toString('base64');

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64,
      },
    },
    'Extract all text content from this PDF document. Preserve section headings and structure. Output only the text content, no commentary.',
  ]);

  return result.response.text();
}

/**
 * Extract text from DOCX files
 * Note: This is a simplified extraction - for production, consider using mammoth.js
 */
async function extractTextFromDocx(docxBuffer: ArrayBuffer): Promise<string> {
  // DOCX files are ZIP archives with XML content
  // For now, we'll use Gemini to extract text from the document
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const base64 = Buffer.from(docxBuffer).toString('base64');

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: base64,
      },
    },
    'Extract all text content from this Word document. Preserve section headings and structure. Output only the text content, no commentary.',
  ]);

  return result.response.text();
}

/**
 * Chunk document into smaller pieces for embedding
 */
interface ChunkMetadata {
  content: string;
  sectionTitle?: string;
  pageNumber?: number;
  tokenCount: number;
  embedding?: number[];
}

function chunkDocument(text: string, documentTitle: string): ChunkMetadata[] {
  const chunks: ChunkMetadata[] = [];

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = '';
  let currentSection = documentTitle;
  let currentTokenCount = 0;

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) continue;

    // Detect section headers (lines that look like headings)
    if (isLikelyHeader(trimmedPara)) {
      // Save current chunk if not empty
      if (currentChunk.trim().length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          sectionTitle: currentSection,
          tokenCount: currentTokenCount,
        });
        currentChunk = '';
        currentTokenCount = 0;
      }
      currentSection = trimmedPara;
      continue;
    }

    const paraTokens = estimateTokenCount(trimmedPara);

    // Check if adding this paragraph would exceed max size
    if (currentTokenCount + paraTokens > MAX_CHUNK_SIZE && currentChunk.trim().length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        sectionTitle: currentSection,
        tokenCount: currentTokenCount,
      });

      // Start new chunk with overlap
      const overlapText = getOverlapText(currentChunk, CHUNK_OVERLAP);
      currentChunk = overlapText + '\n\n' + trimmedPara;
      currentTokenCount = estimateTokenCount(currentChunk);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
      currentTokenCount += paraTokens;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      sectionTitle: currentSection,
      tokenCount: currentTokenCount,
    });
  }

  return chunks;
}

/**
 * Check if a line is likely a section header
 */
function isLikelyHeader(text: string): boolean {
  // Short lines that are all caps, numbered, or have markdown-style headers
  if (text.length > 100) return false;
  if (text.startsWith('#')) return true;
  if (/^\d+\.\s+[A-Z]/.test(text)) return true;
  if (/^[A-Z][A-Z\s]+$/.test(text) && text.length < 50) return true;
  if (/^(Chapter|Section|Part)\s+\d/i.test(text)) return true;
  return false;
}

/**
 * Estimate token count (rough approximation: 4 chars per token)
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get overlap text from the end of a chunk
 */
function getOverlapText(text: string, targetTokens: number): string {
  const targetChars = targetTokens * 4;
  if (text.length <= targetChars) return text;

  // Find a good break point (sentence or paragraph)
  const startIdx = text.length - targetChars;
  const textFromStart = text.substring(startIdx);

  // Try to start at a sentence boundary
  const sentenceMatch = textFromStart.match(/^[^.!?]*[.!?]\s+/);
  if (sentenceMatch) {
    return textFromStart.substring(sentenceMatch[0].length);
  }

  return textFromStart;
}

/**
 * Generate embeddings for chunks using Gemini
 */
async function generateEmbeddings(chunks: ChunkMetadata[]): Promise<ChunkMetadata[]> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const results: ChunkMetadata[] = [];

  // Process in batches to avoid rate limits
  const batchSize = 5;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    const embeddings = await Promise.all(
      batch.map(async (chunk) => {
        try {
          const result = await model.embedContent(chunk.content);
          const embedding = result.embedding.values;

          // Pad embedding to 1536 dimensions for OpenAI compatibility
          // (Google's embedding model outputs 768 dimensions)
          const paddedEmbedding = padEmbedding(embedding, 1536);

          return {
            ...chunk,
            embedding: paddedEmbedding,
          };
        } catch (error) {
          console.error('Error generating embedding:', error);
          // Return chunk without embedding - it won't be searchable but we preserve the text
          return chunk;
        }
      })
    );

    results.push(...embeddings);

    // Small delay between batches to avoid rate limits
    if (i + batchSize < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Pad embedding to target dimensions (for compatibility with OpenAI vectors)
 */
function padEmbedding(embedding: number[], targetDimensions: number): number[] {
  if (embedding.length >= targetDimensions) {
    return embedding.slice(0, targetDimensions);
  }

  // Pad with zeros
  const padded = [...embedding];
  while (padded.length < targetDimensions) {
    padded.push(0);
  }
  return padded;
}

/**
 * Re-process a failed document
 */
export async function reprocessDocument(
  supabase: SupabaseClient,
  documentId: string
): Promise<ProcessingResult> {
  // Delete existing chunks
  await supabase
    .from('rosa_knowledge_chunks')
    .delete()
    .eq('document_id', documentId);

  // Reset status
  await supabase
    .from('rosa_knowledge_documents')
    .update({
      status: 'pending',
      processing_error: null,
      chunk_count: 0,
    })
    .eq('id', documentId);

  // Process again
  return processDocument(supabase, documentId);
}

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(
  supabase: SupabaseClient,
  documentId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('rosa_knowledge_documents')
    .delete()
    .eq('id', documentId);

  return !error;
}

/**
 * Archive a document (soft delete)
 */
export async function archiveDocument(
  supabase: SupabaseClient,
  documentId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('rosa_knowledge_documents')
    .update({ status: 'archived' })
    .eq('id', documentId);

  return !error;
}

/**
 * Get all documents for admin management
 */
export async function getKnowledgeDocuments(
  supabase: SupabaseClient,
  options?: {
    category?: DocumentCategory;
    status?: DocumentStatus;
    limit?: number;
    offset?: number;
  }
): Promise<{ documents: KnowledgeDocument[]; total: number }> {
  let query = supabase
    .from('rosa_knowledge_documents')
    .select('*', { count: 'exact' });

  if (options?.category) {
    query = query.eq('category', options.category);
  }

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching knowledge documents:', error);
    return { documents: [], total: 0 };
  }

  const documents: KnowledgeDocument[] = (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    fileName: row.file_name,
    fileUrl: row.file_url,
    fileType: row.file_type,
    fileSizeBytes: row.file_size_bytes,
    category: row.category as DocumentCategory,
    tags: row.tags || [],
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    publicationDate: row.publication_date ? new Date(row.publication_date) : undefined,
    status: row.status as DocumentStatus,
    processingError: row.processing_error,
    chunkCount: row.chunk_count || 0,
    isPublic: row.is_public,
    organizationId: row.organization_id,
    uploadedBy: row.uploaded_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
  }));

  return { documents, total: count || 0 };
}

/**
 * Upload and create a new knowledge document
 * Call processDocument() after the file is uploaded to storage
 */
export async function createKnowledgeDocument(
  supabase: SupabaseClient,
  params: {
    title: string;
    description?: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSizeBytes?: number;
    category: DocumentCategory;
    tags?: string[];
    sourceName?: string;
    sourceUrl?: string;
    publicationDate?: Date;
    isPublic?: boolean;
    organizationId?: string;
    uploadedBy: string;
  }
): Promise<{ id: string; success: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('rosa_knowledge_documents')
    .insert({
      title: params.title,
      description: params.description,
      file_name: params.fileName,
      file_url: params.fileUrl,
      file_type: params.fileType,
      file_size_bytes: params.fileSizeBytes,
      category: params.category,
      tags: params.tags || [],
      source_name: params.sourceName,
      source_url: params.sourceUrl,
      publication_date: params.publicationDate?.toISOString().split('T')[0],
      is_public: params.isPublic ?? true,
      organization_id: params.organizationId,
      uploaded_by: params.uploadedBy,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    return { id: '', success: false, error: error.message };
  }

  // Automatically trigger processing
  // In production, this would be done via a background job/queue
  processDocument(supabase, data.id).catch((err) => {
    console.error('Background processing failed:', err);
  });

  return { id: data.id, success: true };
}

/**
 * Generate embedding for a query (for semantic search)
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const result = await model.embedContent(query);
  const embedding = result.embedding.values;

  // Pad to 1536 dimensions for compatibility
  return padEmbedding(embedding, 1536);
}

/**
 * Index curated knowledge entries with embeddings
 */
export async function indexCuratedKnowledge(
  supabase: SupabaseClient
): Promise<{
  success: boolean;
  indexed: number;
  error?: string;
}> {
  try {
    // Fetch entries without embeddings
    const { data: entries, error: fetchError } = await supabase
      .from('rosa_curated_knowledge')
      .select('id, content')
      .is('embedding', null)
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    if (!entries || entries.length === 0) {
      return { success: true, indexed: 0 };
    }

    // Generate embeddings
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    let indexed = 0;

    for (const entry of entries) {
      try {
        const result = await model.embedContent(entry.content);
        const embedding = padEmbedding(result.embedding.values, 1536);

        await supabase
          .from('rosa_curated_knowledge')
          .update({ embedding: `[${embedding.join(',')}]` })
          .eq('id', entry.id);

        indexed++;
      } catch (error) {
        console.error(`Error indexing entry ${entry.id}:`, error);
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return { success: true, indexed };
  } catch (error) {
    return {
      success: false,
      indexed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
