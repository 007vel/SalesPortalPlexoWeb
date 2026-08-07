import { Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { RepProfileStore } from '../rep-profile-store/rep-profile-store';

interface ChartBar {
  date: string;
  amount: number;
  isZero: boolean;
  isToday: boolean;
  heightPct: number;
  dayLabel: string;
  dayFull: string;
}

interface TableRow {
  date: string;
  amount: number;
  isToday: boolean;
  dayFull: string;
}

function fmtMoney(n: number): string {
  return '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}
function fmtDayFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

@Component({
  selector: 'app-rep-commission',
  imports: [MatCardModule, MatIconModule, MatTableModule],
  templateUrl: './rep-commission.html',
  styleUrl: './rep-commission.scss',
})
export class RepCommission {
  private readonly repProfileStore = inject(RepProfileStore);
  private readonly todayStr = new Date().toISOString().slice(0, 10);

  readonly fmtMoney = fmtMoney;
  readonly displayedColumns = ['date', 'amount'];

  readonly history = computed(() => this.repProfileStore.profile().commissions);
  readonly earningDays = computed(() => this.history().filter((d) => d.amount > 0));
  readonly total = computed(() => this.history().reduce((sum, d) => sum + d.amount, 0));
  readonly avg = computed(() => (this.earningDays().length ? this.total() / this.earningDays().length : 0));
  readonly best = computed(() => this.history().reduce((m, d) => Math.max(m, d.amount), 0));

  readonly chartBars = computed<ChartBar[]>(() => {
    const history = this.history();
    const max = Math.max(1, ...history.map((d) => d.amount));
    return history.map((d) => {
      const isZero = d.amount <= 0;
      const heightPct = Math.round((d.amount / max) * 100);
      return {
        date: d.date,
        amount: d.amount,
        isZero,
        isToday: d.date === this.todayStr,
        heightPct: isZero ? 3 : Math.max(heightPct, 4),
        dayLabel: fmtDayLabel(d.date),
        dayFull: fmtDayFull(d.date),
      };
    });
  });

  readonly tableRows = computed<TableRow[]>(() =>
    this.history()
      .slice()
      .reverse()
      .map((d) => ({
        date: d.date,
        amount: d.amount,
        isToday: d.date === this.todayStr,
        dayFull: fmtDayFull(d.date),
      })),
  );
}
