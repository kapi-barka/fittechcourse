'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MyProgramsRedirect() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/programs?tab=my')
    }, [router])

    return null
}
