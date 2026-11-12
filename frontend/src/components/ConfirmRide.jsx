import React from 'react'
import { GOODS_TYPES, MAX_HELPERS, VEHICLE_BY_KEY, formatCapacity } from '../vehicles'

const inputClass = 'bg-gray-50 px-3.5 py-3 text-sm rounded-xl w-full border border-gray-200 focus:border-black focus:bg-white focus:outline-none text-gray-900 font-medium placeholder:text-gray-400'
const PHONE_PATTERN = /^\+?[\d\s-]{10,16}$/

// Last step of a booking: what is being sent, who receives it, loading helpers.
const ConfirmRide = (props) => {
    const { goods, setGoods } = props
    const vehicle = VEHICLE_BY_KEY[props.vehicleType]
    const vehicleFare = props.fare?.[props.vehicleType]
    const helperCharge = Number(props.fare?.helperCharge) || 0
    const total = vehicleFare ? vehicleFare + goods.helpers * helperCharge : null

    const set = (key) => (e) => setGoods({ ...goods, [key]: e.target.value })

    const overweight = vehicle && Number(goods.goodsWeight) > vehicle.capacityKg
    const phoneInvalid = goods.receiverPhone && !PHONE_PATTERN.test(goods.receiverPhone.trim())
    const canBook = total && goods.goodsType && goods.receiverName.trim().length >= 2
        && PHONE_PATTERN.test(goods.receiverPhone.trim()) && !overweight && !props.isBooking

    return (
        <div>
            <h5
                className='p-1 text-center w-[93%] absolute top-0 cursor-pointer'
                onClick={() => props.setConfirmRidePanel(false)}
            >
                <i className="text-3xl text-gray-300 ri-arrow-down-wide-line"></i>
            </h5>
            <h3 className='text-2xl font-bold mb-3'>Goods & Receiver</h3>

            <div className='max-h-[70vh] overflow-y-auto pr-1 space-y-3'>
                <div className='bg-gray-50 rounded-2xl p-3.5 flex items-center gap-3'>
                    <div className='h-11 w-12 rounded-xl bg-black flex items-center justify-center flex-shrink-0'>
                        <i className={`${vehicle?.icon || 'ri-truck-fill'} text-xl text-white`}></i>
                    </div>
                    <div className='flex-1 min-w-0'>
                        <p className='font-bold text-gray-900'>{vehicle?.label || 'Vehicle'}</p>
                        <p className='text-xs text-gray-500 truncate'>{props.pickup} → {props.destination}</p>
                    </div>
                    <p className='text-xs text-gray-500 flex-shrink-0'>up to {formatCapacity(vehicle?.capacityKg)}</p>
                </div>

                <div className='grid grid-cols-3 gap-2'>
                    <label className='col-span-2 block'>
                        <span className='text-xs font-semibold text-gray-500 mb-1 block'>What are you sending?</span>
                        <select value={goods.goodsType} onChange={set('goodsType')} className={inputClass}>
                            <option value='' disabled>Select goods type</option>
                            {GOODS_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </label>
                    <label className='block'>
                        <span className='text-xs font-semibold text-gray-500 mb-1 block'>Weight (kg)</span>
                        <input
                            value={goods.goodsWeight}
                            onChange={set('goodsWeight')}
                            type='number'
                            min='1'
                            inputMode='decimal'
                            placeholder='Optional'
                            className={`${inputClass} ${overweight ? 'border-red-400' : ''}`}
                        />
                    </label>
                </div>
                {overweight && (
                    <p className='text-xs text-red-600 -mt-1'>
                        {vehicle.label} carries up to {formatCapacity(vehicle.capacityKg)}. Go back and choose a bigger vehicle.
                    </p>
                )}

                <div className='grid grid-cols-2 gap-2'>
                    <label className='block'>
                        <span className='text-xs font-semibold text-gray-500 mb-1 block'>Receiver name</span>
                        <input value={goods.receiverName} onChange={set('receiverName')} type='text' maxLength={80} placeholder='Who collects it' className={inputClass} />
                    </label>
                    <label className='block'>
                        <span className='text-xs font-semibold text-gray-500 mb-1 block'>Receiver phone</span>
                        <input
                            value={goods.receiverPhone}
                            onChange={set('receiverPhone')}
                            type='tel'
                            inputMode='tel'
                            placeholder='10-digit mobile'
                            className={`${inputClass} ${phoneInvalid ? 'border-red-400' : ''}`}
                        />
                    </label>
                </div>
                {phoneInvalid && <p className='text-xs text-red-600 -mt-1'>Enter a 10-digit phone number.</p>}

                <div className='flex items-center justify-between bg-gray-50 rounded-2xl p-3.5'>
                    <div>
                        <p className='font-semibold text-gray-900 text-sm'>Loading helpers</p>
                        <p className='text-xs text-gray-500'>₹{helperCharge} per helper for loading and unloading</p>
                    </div>
                    <div className='flex items-center gap-3'>
                        <button
                            type='button'
                            aria-label='Remove a helper'
                            disabled={goods.helpers === 0}
                            onClick={() => setGoods({ ...goods, helpers: goods.helpers - 1 })}
                            className='h-9 w-9 rounded-xl bg-white border border-gray-200 font-bold text-lg disabled:opacity-40'
                        >−</button>
                        <span className='w-4 text-center font-bold'>{goods.helpers}</span>
                        <button
                            type='button'
                            aria-label='Add a helper'
                            disabled={goods.helpers >= MAX_HELPERS}
                            onClick={() => setGoods({ ...goods, helpers: goods.helpers + 1 })}
                            className='h-9 w-9 rounded-xl bg-white border border-gray-200 font-bold text-lg disabled:opacity-40'
                        >+</button>
                    </div>
                </div>

                <label className='block'>
                    <span className='text-xs font-semibold text-gray-500 mb-1 block'>Note for the driver (optional)</span>
                    <input value={goods.notes} onChange={set('notes')} type='text' maxLength={300} placeholder='Floor, fragile items, landmark…' className={inputClass} />
                </label>

                <div className='bg-gray-50 rounded-2xl p-3.5 text-sm'>
                    <div className='flex justify-between text-gray-600'>
                        <span>Vehicle fare</span><span>₹{vehicleFare ?? '--'}</span>
                    </div>
                    {goods.helpers > 0 && (
                        <div className='flex justify-between text-gray-600 mt-1'>
                            <span>{goods.helpers} helper{goods.helpers > 1 ? 's' : ''}</span><span>₹{goods.helpers * helperCharge}</span>
                        </div>
                    )}
                    <div className='flex justify-between font-black text-gray-900 text-lg mt-2 pt-2 border-t border-gray-200'>
                        <span>Total</span><span>₹{total ?? '--'}</span>
                    </div>
                </div>

                {props.error && <p className='text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3'>{props.error}</p>}

                <button
                    onClick={props.createRide}
                    disabled={!canBook}
                    className={`w-full font-bold py-4 rounded-2xl text-lg transition-colors ${canBook ? 'bg-black text-white hover:bg-gray-900' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                    {props.isBooking ? 'Booking…' : 'Book Vehicle'}
                </button>
            </div>
        </div>
    )
}

export default ConfirmRide
