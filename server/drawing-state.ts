export interface Point {
  x: number;
  y: number;
}

export type ToolType = 'brush' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text';

export interface DrawingAction {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  tool: ToolType;
  color: string;
  strokeWidth: number;
  points: Point[];
  text?: string;
  timestamp: number;
  undone: boolean;
}

export class DrawingState {
  private actions: DrawingAction[] = [];

  public addAction(action: DrawingAction): DrawingAction {
    action.undone = false;
    this.actions.push(action);
    return action;
  }

  public undoAction(userId?: string): DrawingAction | null {
    // Find the last active action for this user (or overall if user has none)
    for (let i = this.actions.length - 1; i >= 0; i--) {
      const action = this.actions[i];
      if (!action.undone && (!userId || action.userId === userId)) {
        action.undone = true;
        return action;
      }
    }
    // Fallback: If user has no active actions, undo last active action overall
    if (userId) {
      for (let i = this.actions.length - 1; i >= 0; i--) {
        const action = this.actions[i];
        if (!action.undone) {
          action.undone = true;
          return action;
        }
      }
    }
    return null;
  }

  public redoAction(userId?: string): DrawingAction | null {
    // Find the last undone action for this user (or overall)
    for (let i = this.actions.length - 1; i >= 0; i--) {
      const action = this.actions[i];
      if (action.undone && (!userId || action.userId === userId)) {
        action.undone = false;
        return action;
      }
    }
    if (userId) {
      for (let i = this.actions.length - 1; i >= 0; i--) {
        const action = this.actions[i];
        if (action.undone) {
          action.undone = false;
          return action;
        }
      }
    }
    return null;
  }

  public clear(): void {
    this.actions = [];
  }

  public getActiveActions(): DrawingAction[] {
    return this.actions.filter((action) => !action.undone);
  }

  public getAllActions(): DrawingAction[] {
    return this.actions;
  }
}
