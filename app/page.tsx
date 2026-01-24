"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Eye, EyeOff, KeyRound, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [studentId, setStudentId] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ studentId, password }),
        headers: { "Content-Type": "application/json" }
      })

      const data = await res.json()

      if (res.ok) {
        // Save student to local storage for demo purposes
        // In prod, use cookies/session
        localStorage.setItem("currentStudent", JSON.stringify(data.student))
        router.push("/student/profile")
      } else {
        alert(data.error || "登录失败")
      }
    } catch (err) {
      alert("网络错误")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-white/10 bg-gray-900/60 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              智慧寝室
            </CardTitle>
            <CardDescription className="text-gray-400">
              学生登录系统
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>学号</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="pl-9 bg-gray-800 border-gray-700"
                    placeholder="请输入学号"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>密码</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9 bg-gray-800 border-gray-700"
                    placeholder="系统初始密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button variant="premium" className="w-full" type="submit" disabled={loading}>
                {loading ? "登录中..." : "进入系统"}
              </Button>
            </form>

            <div className="text-center text-xs text-gray-500">
              如无法登录，请联系辅导员重置密码
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
