/** Lembretes avulsos em memória durante a sessão do processo. */

export interface SessionReminder {
  id: string;
  domain: string;
  texto: string;
  minutos: number;
  fireAt: string;
  jobId: string;
  createdAt: string;
}

export class SessionReminderStore {
  private readonly items: SessionReminder[] = [];

  add(reminder: SessionReminder): SessionReminder {
    this.items.push(reminder);
    return reminder;
  }

  list(domain?: string): SessionReminder[] {
    if (domain === undefined) {
      return [...this.items];
    }
    return this.items.filter((item) => item.domain === domain);
  }

  clear(): void {
    this.items.length = 0;
  }
}

/** Store da sessão atual do processo Node (voz/CLI). */
export const processSessionReminders = new SessionReminderStore();
