export interface Point {
  x: number;
  y: number;
}

export type ToolType =
  | 'brush'
  | 'eraser'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'diamond'
  | 'text'
  | 'sticky'
  | 'select'
  | 'hand';

export interface DrawingAction {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  tool: ToolType;
  color: string;
  fillColor?: string;
  fillStyle?: 'none' | 'solid' | 'hatch' | 'cross-hatch';
  dashStyle?: 'solid' | 'dashed' | 'dotted';
  sloppiness?: 'architect' | 'artist' | 'cartoon';
  strokeWidth: number;
  points: Point[];
  text?: string;
  noteColor?: string;
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

  public updateActionPosition(actionId: string, deltaX: number, deltaY: number): boolean {
    const action = this.actions.find((a) => a.id === actionId);
    if (action && action.points) {
      action.points = action.points.map((p) => ({
        x: p.x + deltaX,
        y: p.y + deltaY
      }));
      return true;
    }
    return false;
  }

  public undoAction(userId?: string): DrawingAction | null {
    for (let i = this.actions.length - 1; i >= 0; i--) {
      const action = this.actions[i];
      if (!action.undone && (!userId || action.userId === userId)) {
        action.undone = true;
        return action;
      }
    }
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
