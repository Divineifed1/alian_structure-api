import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("alert_preferences")
export class AlertPreference {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column("simple-array")
  channels: string[]; // 'in-app', 'email', 'websocket'

  @Column({ type: "int", nullable: true })
  quietHoursStart: number; // 0-23

  @Column({ type: "int", nullable: true })
  quietHoursEnd: number; // 0-23

  @Column({ type: "int", default: 10 })
  rateLimit: number; // max per hour

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
