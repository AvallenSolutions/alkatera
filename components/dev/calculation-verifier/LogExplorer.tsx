'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface Log {
  id: string
  created_at: string
  status: string
  request_payload?: any
  response_data?: any
  error_message?: string
  calculation_duration_ms?: number
}

interface LogExplorerProps {
  logs: Log[]
  type: 'product_lca' | 'corporate'
}

export default function LogExplorer({ logs, type }: LogExplorerProps) {
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  const toggleLog = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      if (next.has(logId)) {
        next.delete(logId)
      } else {
        next.add(logId)
      }
      return next
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return <Badge className="bg-green-600">Success</Badge>
      case 'failed':
      case 'error':
        return <Badge className="bg-red-600">Failed</Badge>
      case 'pending':
        return <Badge className="bg-amber-600">Pending</Badge>
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>
    }
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <CardTitle>Calculation Logs</CardTitle>
          </div>
          <CardDescription>
            Audit trail of calculation executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No calculation logs found</p>
            <p className="text-xs mt-1">
              Logs will appear here after calculations are executed
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <CardTitle>Calculation Logs</CardTitle>
        </div>
        <CardDescription>
          Audit trail showing {logs.length} recent calculation{logs.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Log ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <>
                  <TableRow key={log.id} className="cursor-pointer" onClick={() => toggleLog(log.id)}>
                    <TableCell>
                      {expandedLogs.has(log.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.id.slice(0, 8)}...</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.calculation_duration_ms
                        ? `${log.calculation_duration_ms}ms`
                        : 'N/A'}
                    </TableCell>
                  </TableRow>
                  {expandedLogs.has(log.id) && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-slate-50">
                        <div className="space-y-4 py-4">
                          {log.error_message && (
                            <div className="bg-red-50 border border-red-200 p-3 rounded">
                              <p className="text-sm font-semibold text-red-900 mb-1">Error Message</p>
                              <p className="text-sm text-red-700">{log.error_message}</p>
                            </div>
                          )}

                          {log.request_payload && (
                            <div>
                              <p className="text-sm font-semibold mb-2">Request Payload</p>
                              <pre className="bg-slate-100 p-3 rounded text-xs overflow-x-auto">
                                {JSON.stringify(log.request_payload, null, 2)}
                              </pre>
                            </div>
                          )}

                          {log.response_data && (
                            <div>
                              <p className="text-sm font-semibold mb-2">Response Data</p>
                              <pre className="bg-slate-100 p-3 rounded text-xs overflow-x-auto max-h-96">
                                {JSON.stringify(log.response_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            Click on any row to expand and view detailed request/response payloads.
            These logs provide complete traceability for audit and compliance purposes.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
