'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FiCheck,
  FiMinus,
  FiPlus,
  FiArrowLeft,
  FiClock,
  FiUser,
  FiPhone,
  FiShoppingCart,
  FiAlertCircle,
  FiMessageCircle,
  FiLoader,
  FiRefreshCw,
  FiInfo,
  FiSend,
  FiEdit3,
} from 'react-icons/fi'
import { BiDish } from 'react-icons/bi'
import { RiRestaurantLine } from 'react-icons/ri'
import { IoFastFoodOutline } from 'react-icons/io5'
import Image from 'next/image'

// =====================================================
// TYPES
// =====================================================
interface MenuItem {
  id: string
  name: string
  price: number
  category: 'pasta' | 'burger'
}

interface OrderFormState {
  customerName: string
  phone: string
  arrivalTime: string
  items: Record<string, number>
  specialInstructions: string
}

interface AgentResponseData {
  whatsapp_message?: string
  order_id?: string
  total_price?: number
  customer_name?: string
  arrival_time?: string
}

interface ValidationErrors {
  customerName?: string
  phone?: string
  arrivalTime?: string
  items?: string
}

type ViewState = 'home' | 'order' | 'confirmation'

// =====================================================
// CONSTANTS
// =====================================================
const AGENT_ID = '699ba20ff7b4833211504832'
const WHATSAPP_PHONE = '919876543210'

const MENU_ITEMS: MenuItem[] = [
  { id: 'pasta-alfredo', name: 'Classic Alfredo Pasta', price: 149, category: 'pasta' },
  { id: 'pasta-tandoori', name: 'Tandoori Pasta', price: 149, category: 'pasta' },
  { id: 'pasta-periperi', name: 'Peri Peri Pasta', price: 149, category: 'pasta' },
  { id: 'pasta-pinksauce', name: 'Pink Sauce Pasta', price: 149, category: 'pasta' },
  { id: 'pasta-arabiata', name: 'Arabiata Pasta', price: 149, category: 'pasta' },
  { id: 'pasta-macncheese', name: 'Mac & Cheese Pasta', price: 149, category: 'pasta' },
  { id: 'burger-classic', name: 'Classic Burger', price: 99, category: 'burger' },
  { id: 'burger-tandoori', name: 'Tandoori Burger', price: 119, category: 'burger' },
  { id: 'burger-periperi', name: 'Peri Peri Burger', price: 119, category: 'burger' },
  { id: 'burger-doublepatty', name: 'Double Patty Burger', price: 159, category: 'burger' },
  { id: 'burger-cheeseburst', name: 'Cheese Burst Burger', price: 139, category: 'burger' },
  { id: 'burger-loaded', name: 'Loaded Burger', price: 169, category: 'burger' },
]

const SAMPLE_ORDER: OrderFormState = {
  customerName: 'Rahul Sharma',
  phone: '9876543210',
  arrivalTime: '',
  items: {
    'pasta-alfredo': 2,
    'burger-tandoori': 1,
    'burger-cheeseburst': 1,
  },
  specialInstructions: 'Extra cheese on the pasta, please. No onions in the burgers.',
}

const SAMPLE_CONFIRMATION: AgentResponseData = {
  whatsapp_message: 'NEW ORDER - NIDAR Pasta & Burger\n\nOrder ID: NID-A7K2M\nCustomer: Rahul Sharma\nPhone: 9876543210\nArrival: 10:30 PM\n\nItems:\n2x Classic Alfredo Pasta - Rs.298\n1x Tandoori Burger - Rs.119\n1x Cheese Burst Burger - Rs.139\n\nTotal: Rs.556\n\nSpecial Instructions: Extra cheese on the pasta, please. No onions in the burgers.',
  order_id: 'NID-A7K2M',
  total_price: 556,
  customer_name: 'Rahul Sharma',
  arrival_time: '10:30 PM',
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================
function generateOrderId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = 'NID-'
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

function getMinArrivalTime(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 25)
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatTimeForDisplay(time24: string): string {
  if (!time24) return ''
  const [hourStr, minuteStr] = time24.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minuteStr} ${ampm}`
}

function validatePhone(phone: string): boolean {
  return /^\d{10}$/.test(phone)
}

function buildAgentMessage(
  form: OrderFormState,
  orderId: string,
  totalPrice: number
): string {
  const selectedItems = MENU_ITEMS.filter((item) => (form.items[item.id] ?? 0) > 0)
  const itemLines = selectedItems
    .map((item) => {
      const qty = form.items[item.id] ?? 0
      return `${qty} x ${item.name} - Rs.${item.price * qty}`
    })
    .join('\n')

  return `Customer Name: ${form.customerName}
Phone: ${form.phone}
Arrival Time: ${formatTimeForDisplay(form.arrivalTime)}
Order ID: ${orderId}

Items:
${itemLines}

Total: Rs.${totalPrice}

Special Instructions: ${form.specialInstructions || 'None'}`
}

// =====================================================
// ERROR BOUNDARY
// =====================================================
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-amber-500 text-gray-950 rounded-md text-sm font-semibold"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// =====================================================
// SUB-COMPONENTS
// =====================================================

function MenuItemCard({
  item,
  quantity,
  onAdd,
  onRemove,
}: {
  item: MenuItem
  quantity: number
  onAdd: () => void
  onRemove: () => void
}) {
  const isSelected = quantity > 0
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-xl border transition-all duration-200',
        isSelected
          ? 'border-amber-500/60 bg-amber-500/10 shadow-md shadow-amber-500/5'
          : 'border-gray-700/50 bg-gray-800/60 hover:border-gray-600/60'
      )}
    >
      <div className="flex-1 min-w-0 mr-3">
        <p className={cn('text-sm font-medium truncate', isSelected ? 'text-amber-50' : 'text-gray-200')}>
          {item.name}
        </p>
        <p className="text-amber-400 text-sm font-bold mt-0.5">
          Rs.{item.price}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {isSelected ? (
          <>
            <button
              onClick={onRemove}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              aria-label={`Remove one ${item.name}`}
            >
              <FiMinus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-amber-400">
              {quantity}
            </span>
            <button
              onClick={onAdd}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 transition-colors"
              aria-label={`Add one more ${item.name}`}
            >
              <FiPlus className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={onAdd}
            className="px-3 h-8 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-amber-500 hover:text-gray-950 text-gray-300 text-xs font-semibold transition-all duration-200"
            aria-label={`Add ${item.name}`}
          >
            ADD
          </button>
        )}
      </div>
    </div>
  )
}

function OrderSummarySection({
  items,
  totalPrice,
}: {
  items: Record<string, number>
  totalPrice: number
}) {
  const selectedItems = MENU_ITEMS.filter((item) => (items[item.id] ?? 0) > 0)

  if (selectedItems.length === 0) {
    return (
      <div className="text-center py-6">
        <FiShoppingCart className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">Your cart is empty</p>
        <p className="text-gray-600 text-xs mt-1">Add items from the menu above</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {selectedItems.map((item) => {
        const qty = items[item.id] ?? 0
        return (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span className="text-gray-300">
              {qty}x {item.name}
            </span>
            <span className="text-amber-400 font-semibold">
              Rs.{item.price * qty}
            </span>
          </div>
        )
      })}
      <Separator className="bg-gray-700 my-3" />
      <div className="flex items-center justify-between">
        <span className="text-white font-bold text-base">Total</span>
        <span className="text-amber-400 font-bold text-lg">Rs.{totalPrice}</span>
      </div>
    </div>
  )
}

function AgentStatusPanel({ isActive }: { isActive: boolean }) {
  return (
    <div className="border border-gray-700/50 bg-gray-800/40 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <FiInfo className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-400 font-medium">Powered by AI</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            isActive ? 'bg-amber-400 animate-pulse' : 'bg-green-500'
          )}
        />
        <span className="text-xs text-gray-300">Order Dispatch Agent</span>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0 h-4 ml-auto',
            isActive
              ? 'border-amber-500/50 text-amber-400'
              : 'border-gray-600 text-gray-500'
          )}
        >
          {isActive ? 'Processing' : 'Ready'}
        </Badge>
      </div>
    </div>
  )
}

// =====================================================
// VIEW: HOME
// =====================================================
function HomeView({
  onOrderNow,
  sampleMode,
}: {
  onOrderNow: () => void
  sampleMode: boolean
}) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Image Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://asset.lyzr.app/H53A0z20"
          alt="NIDAR Pasta and Burger background"
          fill
          className="object-cover opacity-20"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950/80 via-gray-950/60 to-gray-950" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1">
        {/* Header spacer */}
        <div className="pt-12" />

        {/* Logo and branding */}
        <div className="flex flex-col items-center px-6 pt-8">
          <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-amber-500/30 shadow-2xl shadow-amber-500/10 mb-6">
            <Image
              src="https://asset.lyzr.app/pGb7L6O7"
              alt="NIDAR Restaurant Logo"
              width={112}
              height={112}
              className="object-cover w-full h-full"
              unoptimized
            />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white text-center tracking-tight">
            NIDAR
          </h1>
          <h2 className="text-lg md:text-xl font-semibold text-amber-400 text-center mt-1">
            Pasta & Burger
          </h2>

          <div className="h-px w-16 bg-gradient-to-r from-transparent via-amber-500 to-transparent my-5" />

          <p className="text-gray-300 text-base text-center max-w-xs leading-relaxed">
            Order before you arrive
          </p>

          <div className="flex items-center gap-2 mt-4 bg-gray-800/70 border border-gray-700/50 rounded-full px-4 py-2">
            <FiClock className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-gray-300 font-medium">8 PM - 2 AM</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA Section */}
        <div className="px-6 pb-10 space-y-4">
          {sampleMode && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
              <p className="text-amber-300 text-xs">
                Sample mode active -- tap Order Now to see a pre-filled order form
              </p>
            </div>
          )}

          <Button
            onClick={onOrderNow}
            className="w-full h-14 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-lg rounded-2xl shadow-lg shadow-amber-500/20 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <IoFastFoodOutline className="w-5 h-5 mr-2" />
            Order Now
          </Button>

          <p className="text-center text-gray-600 text-xs">
            Pre-order and skip the wait
          </p>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// VIEW: ORDER
// =====================================================
function OrderView({
  form,
  setForm,
  onBack,
  onSubmit,
  loading,
  errorMessage,
  sampleMode,
}: {
  form: OrderFormState
  setForm: React.Dispatch<React.SetStateAction<OrderFormState>>
  onBack: () => void
  onSubmit: () => void
  loading: boolean
  errorMessage: string
  sampleMode: boolean
}) {
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [minTime, setMinTime] = useState('')

  useEffect(() => {
    setMinTime(getMinArrivalTime())
    const interval = setInterval(() => {
      setMinTime(getMinArrivalTime())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const totalPrice = useMemo(() => {
    return MENU_ITEMS.reduce((sum, item) => {
      const qty = form.items[item.id] ?? 0
      return sum + item.price * qty
    }, 0)
  }, [form.items])

  const totalItems = useMemo(() => {
    return Object.values(form.items).reduce((sum, qty) => sum + qty, 0)
  }, [form.items])

  const pastaItems = MENU_ITEMS.filter((m) => m.category === 'pasta')
  const burgerItems = MENU_ITEMS.filter((m) => m.category === 'burger')

  const validate = useCallback((): boolean => {
    const errs: ValidationErrors = {}
    if (!form.customerName || form.customerName.trim().length < 2) {
      errs.customerName = 'Name must be at least 2 characters'
    }
    if (!validatePhone(form.phone)) {
      errs.phone = 'Enter a valid 10-digit phone number'
    }
    if (!form.arrivalTime) {
      errs.arrivalTime = 'Please select an arrival time'
    } else if (form.arrivalTime < minTime) {
      errs.arrivalTime = `Arrival must be at least 25 minutes from now (after ${formatTimeForDisplay(minTime)})`
    }
    if (totalItems === 0) {
      errs.items = 'Please add at least one item to your order'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [form, minTime, totalItems])

  const handleSubmit = () => {
    if (validate()) {
      onSubmit()
    }
  }

  const addItem = (id: string) => {
    setForm((prev) => ({
      ...prev,
      items: { ...prev.items, [id]: (prev.items[id] ?? 0) + 1 },
    }))
    if (errors.items) {
      setErrors((prev) => ({ ...prev, items: undefined }))
    }
  }

  const removeItem = (id: string) => {
    setForm((prev) => {
      const current = prev.items[id] ?? 0
      if (current <= 1) {
        const newItems = { ...prev.items }
        delete newItems[id]
        return { ...prev, items: newItems }
      }
      return { ...prev, items: { ...prev.items, [id]: current - 1 } }
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-32">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-md border-b border-gray-800/60">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition-colors"
            aria-label="Go back"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white">Place Your Order</h1>
            <p className="text-xs text-gray-500">NIDAR Pasta & Burger</p>
          </div>
          {totalItems > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-full px-3 py-1">
              <FiShoppingCart className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-400">{totalItems}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-5">
        {/* Customer Details */}
        <Card className="bg-gray-900 border-gray-800 shadow-lg">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <FiUser className="w-4 h-4 text-amber-400" />
              Your Details
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div>
              <Label htmlFor="name" className="text-xs text-gray-400 mb-1 block">
                Name *
              </Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={form.customerName}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, customerName: e.target.value }))
                  if (errors.customerName) setErrors((prev) => ({ ...prev, customerName: undefined }))
                }}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-10 focus:border-amber-500 focus:ring-amber-500/20"
              />
              {errors.customerName && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <FiAlertCircle className="w-3 h-3" /> {errors.customerName}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="phone" className="text-xs text-gray-400 mb-1 block">
                Phone Number *
              </Label>
              <div className="flex gap-2">
                <div className="flex items-center justify-center px-3 bg-gray-800 border border-gray-700 rounded-md text-gray-400 text-sm">
                  +91
                </div>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit number"
                  maxLength={10}
                  value={form.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                    setForm((prev) => ({ ...prev, phone: val }))
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }))
                  }}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-10 focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
              {errors.phone && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <FiAlertCircle className="w-3 h-3" /> {errors.phone}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="arrival" className="text-xs text-gray-400 mb-1 block">
                Arrival Time * <span className="text-gray-600">(min 25 min from now)</span>
              </Label>
              <Input
                id="arrival"
                type="time"
                value={form.arrivalTime}
                min={minTime}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, arrivalTime: e.target.value }))
                  if (errors.arrivalTime) setErrors((prev) => ({ ...prev, arrivalTime: undefined }))
                }}
                className="bg-gray-800 border-gray-700 text-white h-10 focus:border-amber-500 focus:ring-amber-500/20 [color-scheme:dark]"
              />
              {errors.arrivalTime && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <FiAlertCircle className="w-3 h-3" /> {errors.arrivalTime}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Menu Section */}
        <Card className="bg-gray-900 border-gray-800 shadow-lg">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <RiRestaurantLine className="w-4 h-4 text-amber-400" />
              Menu
            </CardTitle>
            {errors.items && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <FiAlertCircle className="w-3 h-3" /> {errors.items}
              </p>
            )}
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Tabs defaultValue="pasta" className="w-full">
              <TabsList className="w-full bg-gray-800 border border-gray-700 h-9 rounded-xl mb-3">
                <TabsTrigger
                  value="pasta"
                  className="flex-1 text-xs font-semibold rounded-lg data-[state=active]:bg-amber-500 data-[state=active]:text-gray-950 data-[state=active]:shadow-md text-gray-400 h-7"
                >
                  <BiDish className="w-3.5 h-3.5 mr-1" />
                  Pasta
                </TabsTrigger>
                <TabsTrigger
                  value="burger"
                  className="flex-1 text-xs font-semibold rounded-lg data-[state=active]:bg-amber-500 data-[state=active]:text-gray-950 data-[state=active]:shadow-md text-gray-400 h-7"
                >
                  <IoFastFoodOutline className="w-3.5 h-3.5 mr-1" />
                  Burgers
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pasta" className="mt-0 space-y-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                  All pastas Rs.149
                </p>
                {pastaItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    quantity={form.items[item.id] ?? 0}
                    onAdd={() => addItem(item.id)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </TabsContent>

              <TabsContent value="burger" className="mt-0 space-y-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                  Burgers Rs.99 - Rs.169
                </p>
                {burgerItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    quantity={form.items[item.id] ?? 0}
                    onAdd={() => addItem(item.id)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Special Instructions */}
        <Card className="bg-gray-900 border-gray-800 shadow-lg">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <FiEdit3 className="w-4 h-4 text-amber-400" />
              Special Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Textarea
              placeholder="Any special requests? (optional)"
              value={form.specialInstructions}
              onChange={(e) => setForm((prev) => ({ ...prev, specialInstructions: e.target.value }))}
              rows={3}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 resize-none focus:border-amber-500 focus:ring-amber-500/20 text-sm"
            />
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card className="bg-gray-900 border-gray-800 shadow-lg">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <FiShoppingCart className="w-4 h-4 text-amber-400" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <OrderSummarySection items={form.items} totalPrice={totalPrice} />
          </CardContent>
        </Card>

        {/* Agent Status */}
        <AgentStatusPanel isActive={loading} />

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <FiAlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-300 text-sm">{errorMessage}</p>
          </div>
        )}

        {/* Spacer for fixed button */}
        <div className="h-4" />
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur-md border-t border-gray-800/60 p-4">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 font-bold text-base rounded-2xl shadow-lg shadow-amber-500/20 transition-all duration-300 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <FiLoader className="w-4 h-4 animate-spin" />
                Processing Order...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FiSend className="w-4 h-4" />
                Place Order
                {totalPrice > 0 && (
                  <span className="ml-1">-- Rs.{totalPrice}</span>
                )}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// VIEW: CONFIRMATION
// =====================================================
function ConfirmationView({
  agentData,
  orderForm,
  orderId,
  totalPrice,
  onNewOrder,
}: {
  agentData: AgentResponseData
  orderForm: OrderFormState
  orderId: string
  totalPrice: number
  onNewOrder: () => void
}) {
  const displayOrderId = agentData?.order_id ?? orderId
  const displayName = agentData?.customer_name ?? orderForm.customerName
  const displayTime = agentData?.arrival_time ?? formatTimeForDisplay(orderForm.arrivalTime)
  const displayTotal = agentData?.total_price ?? totalPrice
  const whatsappMessage = agentData?.whatsapp_message ?? ''

  const whatsappUrl = whatsappMessage
    ? `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(whatsappMessage)}`
    : ''

  const selectedItems = MENU_ITEMS.filter((item) => (orderForm.items[item.id] ?? 0) > 0)

  return (
    <div className="min-h-screen bg-gray-950 pb-8">
      {/* Success Header */}
      <div className="bg-gradient-to-b from-green-900/30 via-gray-950 to-gray-950 pt-12 pb-6 px-6 text-center">
        <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500/40 rounded-full flex items-center justify-center mx-auto mb-4">
          <FiCheck className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">
          Order Placed Successfully!
        </h1>
        <p className="text-gray-400 text-sm">
          Your food will be ready when you arrive
        </p>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-4">
        {/* Order ID Highlight */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center">
          <p className="text-xs text-amber-300/70 uppercase tracking-wider font-semibold mb-1">
            Order ID
          </p>
          <p className="text-2xl font-bold text-amber-400 tracking-wider">
            {displayOrderId}
          </p>
        </div>

        {/* Customer & Time Details */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiUser className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-400">Customer</span>
              </div>
              <span className="text-sm text-white font-medium">{displayName}</span>
            </div>
            <Separator className="bg-gray-800" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiPhone className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-400">Phone</span>
              </div>
              <span className="text-sm text-white font-medium">+91 {orderForm.phone}</span>
            </div>
            <Separator className="bg-gray-800" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiClock className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-400">Arrival Time</span>
              </div>
              <span className="text-sm text-amber-400 font-semibold">{displayTime}</span>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-300">
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {selectedItems.map((item) => {
                const qty = orderForm.items[item.id] ?? 0
                return (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">
                      {qty}x {item.name}
                    </span>
                    <span className="text-amber-400 font-semibold">
                      Rs.{item.price * qty}
                    </span>
                  </div>
                )
              })}
              {orderForm.specialInstructions && (
                <>
                  <Separator className="bg-gray-800 my-2" />
                  <div className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-400">Note: </span>
                    {orderForm.specialInstructions}
                  </div>
                </>
              )}
              <Separator className="bg-gray-800 my-2" />
              <div className="flex items-center justify-between">
                <span className="text-white font-bold text-base">Total</span>
                <span className="text-amber-400 font-bold text-lg">Rs.{displayTotal}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Message Preview */}
        {whatsappMessage && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <FiMessageCircle className="w-4 h-4 text-green-400" />
                WhatsApp Message Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ScrollArea className="max-h-48">
                <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans leading-relaxed bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  {whatsappMessage}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
            >
              <FiMessageCircle className="w-5 h-5" />
              Send via WhatsApp
            </a>
          )}

          <Button
            onClick={onNewOrder}
            variant="outline"
            className="w-full h-12 bg-transparent border-gray-700 hover:bg-gray-800 text-gray-300 hover:text-white font-semibold text-sm rounded-2xl transition-all duration-200"
          >
            <FiRefreshCw className="w-4 h-4 mr-2" />
            Place Another Order
          </Button>
        </div>

        {/* Agent Status */}
        <AgentStatusPanel isActive={false} />
      </div>
    </div>
  )
}

// =====================================================
// MAIN PAGE COMPONENT
// =====================================================
export default function Page() {
  const [view, setView] = useState<ViewState>('home')
  const [sampleMode, setSampleMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [orderId, setOrderId] = useState('')
  const [agentResponse, setAgentResponse] = useState<AgentResponseData | null>(null)

  const emptyForm: OrderFormState = {
    customerName: '',
    phone: '',
    arrivalTime: '',
    items: {},
    specialInstructions: '',
  }

  const [form, setForm] = useState<OrderFormState>(emptyForm)

  const totalPrice = useMemo(() => {
    return MENU_ITEMS.reduce((sum, item) => {
      const qty = form.items[item.id] ?? 0
      return sum + item.price * qty
    }, 0)
  }, [form.items])

  const handleOrderNow = useCallback(() => {
    if (sampleMode) {
      const sampleArrival = getMinArrivalTime()
      setForm({ ...SAMPLE_ORDER, arrivalTime: sampleArrival })
    }
    setView('order')
    setErrorMessage('')
  }, [sampleMode])

  const handleBack = useCallback(() => {
    setView('home')
    setErrorMessage('')
  }, [])

  const handleSubmitOrder = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    const newOrderId = generateOrderId()
    setOrderId(newOrderId)

    if (sampleMode) {
      // In sample mode, skip the agent call and show sample confirmation
      setAgentResponse(SAMPLE_CONFIRMATION)
      setLoading(false)
      setView('confirmation')
      return
    }

    const currentTotal = MENU_ITEMS.reduce((sum, item) => {
      const qty = form.items[item.id] ?? 0
      return sum + item.price * qty
    }, 0)

    const message = buildAgentMessage(form, newOrderId, currentTotal)

    try {
      const result = await callAIAgent(message, AGENT_ID)

      if (result?.success && result?.response?.result) {
        const data = result.response.result
        const parsed: AgentResponseData = {
          whatsapp_message: data?.whatsapp_message ?? data?.whatsappMessage ?? '',
          order_id: data?.order_id ?? data?.orderId ?? newOrderId,
          total_price: data?.total_price ?? data?.totalPrice ?? currentTotal,
          customer_name: data?.customer_name ?? data?.customerName ?? form.customerName,
          arrival_time: data?.arrival_time ?? data?.arrivalTime ?? formatTimeForDisplay(form.arrivalTime),
        }
        setAgentResponse(parsed)
        setView('confirmation')
      } else {
        const errMsg = result?.error ?? result?.response?.message ?? 'Something went wrong. Please try again.'
        setErrorMessage(errMsg)
      }
    } catch (err) {
      setErrorMessage('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [form, sampleMode])

  const handleNewOrder = useCallback(() => {
    setForm(emptyForm)
    setAgentResponse(null)
    setOrderId('')
    setErrorMessage('')
    setView('home')
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Sample Data Toggle */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-gray-900/90 backdrop-blur-md border border-gray-700/50 rounded-full px-3 py-1.5 shadow-lg">
          <Label htmlFor="sample-toggle" className="text-[10px] text-gray-400 font-medium cursor-pointer whitespace-nowrap">
            Sample Data
          </Label>
          <Switch
            id="sample-toggle"
            checked={sampleMode}
            onCheckedChange={(checked) => {
              setSampleMode(checked)
              if (checked && view === 'order') {
                const sampleArrival = getMinArrivalTime()
                setForm({ ...SAMPLE_ORDER, arrivalTime: sampleArrival })
              } else if (!checked && view === 'order') {
                setForm(emptyForm)
              }
              if (checked && view === 'home') {
                // Stay on home, user will see pre-filled on next page
              }
            }}
            className="scale-75"
          />
        </div>

        {/* Views */}
        {view === 'home' && (
          <HomeView onOrderNow={handleOrderNow} sampleMode={sampleMode} />
        )}
        {view === 'order' && (
          <OrderView
            form={form}
            setForm={setForm}
            onBack={handleBack}
            onSubmit={handleSubmitOrder}
            loading={loading}
            errorMessage={errorMessage}
            sampleMode={sampleMode}
          />
        )}
        {view === 'confirmation' && agentResponse && (
          <ConfirmationView
            agentData={agentResponse}
            orderForm={form}
            orderId={orderId}
            totalPrice={totalPrice}
            onNewOrder={handleNewOrder}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
