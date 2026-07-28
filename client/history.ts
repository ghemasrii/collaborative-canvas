import { DrawingAction } from './canvas';

export class HistoryManager {
  private actions: DrawingAction[] = [];

  public setActions(actions: DrawingAction[]): void {
    this.actions = actions;
  }

  public addAction(action: DrawingAction): void {
    this.actions.push(action);
  }

  public getActiveActions(): DrawingAction[] {
    return this.actions.filter((a) => !a.undone);
  }

  public clear(): void {
    this.actions = [];
  }
}
