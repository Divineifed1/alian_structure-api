import { Column, Entity, PrimaryGeneratedColumn, Index } from "typeorm";

@Entity({ name: "indexed_event" })
@Index(["txHash", "logIndex", "address", "topic0"], { unique: true })
export class IndexedEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "bigint" })
  blockNumber: string;

  @Column()
  blockHash: string;

  @Column()
  txHash: string;

  @Column({ type: "integer" })
  logIndex: number;

  @Column()
  address: string;

  @Column({ nullable: true })
  topic0: string;

  @Column({ type: "jsonb" })
  data: any;

  @Column({ type: "jsonb", nullable: true })
  topics: any;

  @Column({ type: "timestamptz", default: () => "now()" })
  processedAt: Date;
}
