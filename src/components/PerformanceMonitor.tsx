import React, { useEffect, useState } from 'react';

interface PerformanceMonitorProps {
  lastSaveTime: number;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ lastSaveTime }) => {
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    violations: number;
    lastViolation: string | null;
  }>({
    violations: 0,
    lastViolation: null,
  });

  useEffect(() => {
    // Monitor for performance violations
    const originalConsoleLog = console.log;
    let violationCount = 0;

    console.log = (...args) => {
      const message = args.join(' ');
      if (message.includes('[Violation]')) {
        violationCount++;
        setPerformanceMetrics(prev => ({
          violations: violationCount,
          lastViolation: message,
        }));
      }
      originalConsoleLog.apply(console, args);
    };

    return () => {
      console.log = originalConsoleLog;
    };
  }, []);

  // Only show if there are performance issues
  if (performanceMetrics.violations === 0 && lastSaveTime < 100) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-xs z-50">
      <div className="font-semibold text-gray-700 mb-2">Performance Monitor</div>
      
      {lastSaveTime > 100 && (
        <div className="text-orange-600 mb-1">
          ⚠️ Slow save: {lastSaveTime.toFixed(0)}ms
        </div>
      )}
      
      {performanceMetrics.violations > 0 && (
        <div className="text-red-600 mb-1">
          🚨 Violations: {performanceMetrics.violations}
        </div>
      )}
      
      {performanceMetrics.lastViolation && (
        <div className="text-gray-500 text-xs max-w-xs truncate">
          Last: {performanceMetrics.lastViolation}
        </div>
      )}
    </div>
  );
};
