'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, User } from 'lucide-react';
import Image from 'next/image';

const MAP_WIDTH = 16;
const MAP_HEIGHT = 9;
const TILE_SIZE = 48; // The size of each tile in pixels

export default function MapTestPage() {
  const [mapData, setMapData] = useState<number[][] | null>(null);
  const [characterPos, setCharacterPos] = useState({ x: 1, y: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const response = await fetch('/maps/map1/map1.json');
        if (!response.ok) {
          throw new Error(`Failed to load map data: ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.grid || data.grid.length !== MAP_HEIGHT || data.grid[0].length !== MAP_WIDTH) {
          throw new Error('Map data has incorrect dimensions.');
        }
        setMapData(data.grid);
      } catch (e: any) {
        setError(e.message);
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMapData();
  }, []);

  const isWalkable = useCallback((x: number, y: number) => {
    if (!mapData) return false;
    if (y < 0 || y >= MAP_HEIGHT || x < 0 || x >= MAP_WIDTH) {
      return false; // Out of bounds
    }
    return mapData[y][x] === 0;
  }, [mapData]);

  const moveCharacter = (dx: number, dy: number) => {
    const newX = characterPos.x + dx;
    const newY = characterPos.y + dy;
    if (isWalkable(newX, newY)) {
      setCharacterPos({ x: newX, y: newY });
    }
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch(event.key) {
        case 'ArrowUp':
        case 'w':
            moveCharacter(0, -1);
            break;
        case 'ArrowDown':
        case 's':
            moveCharacter(0, 1);
            break;
        case 'ArrowLeft':
        case 'a':
            moveCharacter(-1, 0);
            break;
        case 'ArrowRight':
        case 'd':
            moveCharacter(1, 0);
            break;
    }
  }, [moveCharacter]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
  
  const resetPosition = () => {
    setCharacterPos({ x: 1, y: 1 });
  };

  const renderContent = () => {
    if (isLoading) {
      return <p>Loading map data...</p>;
    }
    if (error) {
      return <p className="text-destructive">Error: {error}</p>;
    }
    if (mapData) {
      return (
        <div className="flex flex-col md:flex-row gap-8 items-center">
            <div
            className="relative bg-gray-700 overflow-hidden border-4 border-gray-900 shadow-lg"
            style={{ width: MAP_WIDTH * TILE_SIZE, height: MAP_HEIGHT * TILE_SIZE }}
          >
            <Image
              src="/maps/map1/map1.png"
              alt="Game Map"
              fill
              className="object-cover"
              unoptimized
              onError={() => setError("Failed to load map image. Please ensure /public/maps/map1/map1.png exists.")}
            />
             <div
              className="absolute transition-all duration-200 ease-in-out flex items-center justify-center"
              style={{
                width: TILE_SIZE,
                height: TILE_SIZE,
                left: characterPos.x * TILE_SIZE,
                top: characterPos.y * TILE_SIZE,
              }}
            >
                <User className="h-8 w-8 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" />
             </div>
          </div>
          <div className="flex flex-col items-center gap-4">
             <div className="grid grid-cols-3 gap-2">
                <div></div>
                <Button onClick={() => moveCharacter(0, -1)}><ArrowUp /></Button>
                <div></div>
                <Button onClick={() => moveCharacter(-1, 0)}><ArrowLeft /></Button>
                <Button onClick={() => moveCharacter(0, 1)}><ArrowDown /></Button>
                <Button onClick={() => moveCharacter(1, 0)}><ArrowRight /></Button>
             </div>
             <Button onClick={resetPosition} variant="outline" size="sm">
                <Home className="mr-2 h-4 w-4" /> Reset Position
             </Button>
             <div className="text-sm text-muted-foreground p-2 rounded-md border bg-muted">
                <p>Use arrow keys or WASD to move.</p>
                <p>Current Position: ({characterPos.x}, {characterPos.y})</p>
             </div>
          </div>
        </div>
      );
    }
    return <p>No map data loaded.</p>;
  };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Map Movement Test"
        description="Test character movement on a grid-based map using JSON collision data."
      />
      <main className="flex flex-1 items-center justify-center p-6 pt-0">
        <Card className="w-auto">
          <CardContent className="p-6">
            {renderContent()}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
