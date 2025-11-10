'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/utils/supabase/client'

// Define the structure of the API response
interface ApiResponse {
  status: number
  data: {
    message: string
    requestId: string
    // Allow any other properties that might be returned
    [key: string]: any
  } | null
  error: string | null
}

// Define the structure of a calculation log entry
interface CalculationLog {
  id: string
  created_at: string
  request_id: string
  calculation_engine_version: string
  calculation_logic_version: string
  emissions_factor_version: string
  data_provenance_trail_id: string
  result_value: number
  result_unit: string
  raw_inputs: any
  raw_outputs: any
}

export default function TestHarnessPage() {
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null)
  const [calculationLogs, setCalculationLogs] = useState<CalculationLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleRunTest = async () => {
    setIsLoading(true)
    setError(null)
    setApiResponse(null)
    setCalculationLogs([])

    try {
      // 1. Invoke the Edge Function
      const { data, error: functionError } = await supabase.functions.invoke(
        'invoke-corporate-calculations',
        {
          body: {
            // This is a sample payload.
            // In a real scenario, this would be dynamic.
            calculation_type: 'scope_1_mobile_combustion',
            company_id: 'c8a9b9e6-9e1a-4f8e-a9d8-7e1d3e1f7a0c', // Example UUID
            user_provided_data_id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef', // Example UUID from a user form
            parameters: {
              fuel_type: 'gasoline',
              distance_km: 15000,
              vehicle_type: 'passenger_car',
            },
          },
        }
      )

      if (functionError) {
        throw new Error(`Edge Function error: ${functionError.message}`)
      }
      
      const responseData = data.data; // Access nested data property
      setApiResponse({ status: data.status, data: responseData, error: data.error })


      // 2. If the function call was successful and returned a requestId, poll for logs
      if (responseData && responseData.requestId) {
        console.log(`Polling for logs with requestId: ${responseData.requestId}`)
        // Simple polling mechanism
        let attempts = 0
        const maxAttempts = 10
        const interval = setInterval(async () => {
          const { data: logData, error: logError } = await supabase
            .from('calculation_logs')
            .select('*')
            .eq('request_id', responseData.requestId)

          if (logError) {
            setError(`Error fetching calculation logs: ${logError.message}`)
            clearInterval(interval)
            setIsLoading(false)
            return
          }

          if (logData && logData.length > 0) {
            console.log("Logs found!", logData)
            setCalculationLogs(logData)
            clearInterval(interval)
            setIsLoading(false)
          } else {
            attempts++
            console.log(`Attempt ${attempts}: Logs not found yet.`)
            if (attempts >= maxAttempts) {
              setError('Polling timed out. No calculation logs found for this request.')
              clearInterval(interval)
              setIsLoading(false)
            }
          }
        }, 2000) // Poll every 2 seconds
      } else {
        setIsLoading(false)
        setError("Function did not return a requestId.")
      }
    } catch (e: any) {
      setError(e.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <header className="flex flex-col items-start space-y-2">
        <h1 className="text-2xl font-bold">Calculation Engine Test Harness</h1>
        <p className="text-muted-foreground">
          Use this tool to invoke the `invoke-corporate-calculations` orchestrator and view the results and audit logs.
        </p>
      </header>
      
      <Button onClick={handleRunTest} disabled={isLoading}>
        {isLoading ? 'Running Test...' : 'Run Test'}
      </Button>

      {error && (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md text-sm text-red-700 dark:text-red-300 overflow-x-auto">
              {error}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>API Response</CardTitle>
            <CardDescription>Direct output from the Edge Function invocation.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-md text-sm overflow-x-auto">
              {apiResponse ? JSON.stringify(apiResponse, null, 2) : 'No response yet...'}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Calculation Logs</CardTitle>
            <CardDescription>
              Records retrieved from the `calculation_logs` table matching the request ID.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculationLogs.length > 0 ? (
                    calculationLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">{log.request_id}</TableCell>
                        <TableCell>{`${log.result_value.toFixed(2)} ${log.result_unit}`}</TableCell>
                        <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        No logs found...
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}