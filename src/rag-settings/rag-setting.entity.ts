import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('rag_settings')
export class RagSetting {
  @PrimaryColumn({ default: 'default' })
  id: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'chunk_size_tokens', default: 512 })
  chunkSizeTokens: number;

  @Column({ name: 'chunk_overlap_tokens', default: 64 })
  chunkOverlapTokens: number;

  @Column({ name: 'top_k_default', default: 5 })
  topKDefault: number;

  @Column({ name: 'max_context_tokens', default: 4000 })
  maxContextTokens: number;

  @Column({ name: 'max_file_bytes_for_indexing', type: 'bigint', default: '10485760' })
  maxFileBytesForIndexing: string;

  @Column({
    name: 'enabled_mime_types',
    type: 'text',
    array: true,
    default: () =>
      "ARRAY['text/plain','text/markdown','text/csv','application/json']",
  })
  enabledMimeTypes: string[];

  @Column({ name: 'worker_enabled', default: true })
  workerEnabled: boolean;

  @Column({ name: 'worker_concurrency', default: 1 })
  workerConcurrency: number;

  @Column({ name: 'job_batch_size', default: 1 })
  jobBatchSize: number;

  @Column({ name: 'min_seconds_between_jobs', default: 5 })
  minSecondsBetweenJobs: number;

  @Column({ name: 'max_chunks_per_job', default: 200 })
  maxChunksPerJob: number;

  @Column({ name: 'retry_backoff_seconds', default: 30 })
  retryBackoffSeconds: number;

  @Column({ name: 'embedding_provider', default: 'local' })
  embeddingProvider: string;

  @Column({
    name: 'embedding_model',
    default: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
  })
  embeddingModel: string;

  @Column({ name: 'embedding_dimensions', default: 384 })
  embeddingDimensions: number;

  @Column({ name: 'deepseek_enabled', default: false })
  deepseekEnabled: boolean;

  @Column({ name: 'deepseek_base_url', default: 'https://api.deepseek.com' })
  deepseekBaseUrl: string;

  @Column({ name: 'deepseek_model', default: 'deepseek-chat' })
  deepseekModel: string;

  @Column({ name: 'deepseek_api_key', type: 'text', nullable: true })
  deepseekApiKey: string | null;

  @Column({ name: 'deepseek_temperature', type: 'float', default: 0.1 })
  deepseekTemperature: number;

  @Column({ name: 'deepseek_max_helper_tokens', default: 500 })
  deepseekMaxHelperTokens: number;

  @Column({ name: 'deepseek_use_query_rewrite', default: false })
  deepseekUseQueryRewrite: boolean;

  @Column({ name: 'deepseek_use_rerank', default: false })
  deepseekUseRerank: boolean;

  @Column({ name: 'deepseek_use_compression', default: false })
  deepseekUseCompression: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
