"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { CustomerFields, emptyCustomer, type CustomerDraft } from "@/components/customer-fields"
import { Shell } from "@/components/shell"
import { Button } from "@/components/ui/button"

export function Intake() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [customer, setCustomer] = useState<CustomerDraft>(emptyCustomer)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream])

  async function start() {
    setError("")
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      setStream(media)
      if (videoRef.current) {
        videoRef.current.srcObject = media
        await videoRef.current.play()
      }
      const mime = MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm"
      const rec = new MediaRecorder(media, { mimeType: mime, videoBitsPerSecond: 1_800_000 })
      chunks.current = []
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType })
        const extension = rec.mimeType.includes("mp4") ? "mp4" : "webm"
        const next = new File([blob], `intake.${extension}`, { type: blob.type })
        setFile(next)
        setPreview(URL.createObjectURL(blob))
        media.getTracks().forEach((track) => track.stop())
        setStream(null)
      }
      recorder.current = rec
      rec.start()
      setSeconds(0)
      setRecording(true)
      setTimeout(() => {
        if (rec.state === "recording") stop()
      }, 20000)
    } catch {
      setError("The camera is not available. Upload a video instead.")
    }
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop()
    setRecording(false)
  }

  function snapPhoto() {
    const video = videoRef.current
    if (!video?.videoWidth) {
      setError("Start the camera, or use Take photo.")
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      setPhotos((current) => [...current, new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" })])
    }, "image/jpeg", 0.9)
  }

  async function submit(sample = false) {
    setError("")
    if (!customer.firstName.trim() || !customer.lastName.trim() || !customer.customerPhone.trim()) {
      setError("First name, last name, and mobile are required.")
      return
    }
    setBusy(sample ? "Reading the sample clip…" : "Pulling stills and opening the ticket…")
    try {
      const form = new FormData()
      form.set("customer", JSON.stringify(customer))
      if (sample) form.set("sample", "1")
      else if (file) form.set("video", file)
      else if (!photos.length) throw new Error("Record a video or take a photo first.")
      for (const photo of photos) form.append("photos", photo)
      const response = await fetch("/api/intake", { method: "POST", body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Intake failed")
      router.push(`/items/${data.item.id}?new=1`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Intake failed")
      setBusy("")
    }
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.18em] text-muted">New intake</p>
      <h1 className="serif text-4xl">Film a slow turn</h1>
      <p className="mt-3 max-w-xl text-muted">
        About 10–20 seconds. Show the front, back, sides, clasp, and any damage. If it is a watch, hold still on the dial and the caseback so the brand, reference, and caliber can be read.
      </p>
      <div className="mt-6 overflow-hidden border border-line bg-black">
        {!preview && (
          <video ref={videoRef} className="aspect-[3/4] max-h-[55dvh] w-full object-cover" playsInline muted autoPlay />
        )}
        {preview && !recording && <video src={preview} className="aspect-[3/4] max-h-[55dvh] w-full object-cover" controls playsInline />}
      </div>
      <p className="mt-3 text-sm text-muted">{recording ? `Recording ${seconds}s · stops at 20s` : "The ticket is saved as soon as the stills are ready."}</p>
      {error && <p className="mt-3 text-danger">{error}</p>}
      {busy && <p className="mt-3">{busy}</p>}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {!recording && (
          <Button type="button" onClick={start} disabled={Boolean(busy)}>
            Record
          </Button>
        )}
        {recording && (
          <Button type="button" onClick={stop}>
            Stop
          </Button>
        )}
        <Button type="button" variant="outline" onClick={snapPhoto} disabled={Boolean(busy)}>
          Snap photo
        </Button>
        <Button type="button" variant="outline" onClick={() => submit(false)} disabled={(!file && photos.length === 0) || Boolean(busy)}>
          Open ticket
        </Button>
        <label className="inline-flex h-12 cursor-pointer items-center justify-center border border-line bg-white px-5 text-sm">
          Camera video
          <input
            type="file"
            accept="video/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const next = event.target.files?.[0]
              if (!next) return
              setFile(next)
              setPreview(URL.createObjectURL(next))
            }}
          />
        </label>
        <label className="inline-flex h-12 cursor-pointer items-center justify-center border border-line bg-white px-5 text-sm">
          Camera photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const next = [...(event.target.files ?? [])]
              if (next.length) setPhotos((current) => [...current, ...next])
            }}
          />
        </label>
      </div>
      {photos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {photos.map((photo) => (
            <img key={photo.name} src={URL.createObjectURL(photo)} alt="" className="h-20 w-16 object-cover" />
          ))}
        </div>
      )}
      <div className="mt-6 border border-line bg-white p-4">
        <h2 className="serif text-3xl">Customer</h2>
        <p className="mb-3 text-sm text-muted">Only first name, last name, and mobile are required.</p>
        <CustomerFields value={customer} onChange={setCustomer} />
      </div>
      <button type="button" className="mt-6 text-sm underline" onClick={() => submit(true)} disabled={Boolean(busy)}>
        Use the sample clip
      </button>
    </Shell>
  )
}
